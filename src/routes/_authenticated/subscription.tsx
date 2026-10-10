import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, CreditCard, Crown, Receipt, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState, PageHeader, StatCard } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";
import { cancelSubscription, startUpiPayment } from "@/lib/billing.functions";
import { UpiPayDialog, type UpiPayment } from "@/components/app/UpiPayDialog";
import { cn } from "@/lib/utils";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

export const Route = createFileRoute("/_authenticated/subscription")({
  head: () => ({
    meta: [
      { title: "Subscription | Digital Udyam" },
      {
        name: "description",
        content:
          "See your current plan, expiry date, payment status and download every invoice.",
      },
      { property: "og:title", content: "Subscription | Digital Udyam" },
      {
        property: "og:description",
        content: "Manage your Digital Udyam plan, renewals, payments and invoices.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <SubscriptionPage />
    </AppShell>
  ),
});

type Cycle = "MONTHLY" | "YEARLY";

const inr = (n: number) =>
  `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const statusTone: Record<string, string> = {
  TRIAL: "bg-warning/15 text-warning-foreground border-warning/30",
  ACTIVE: "bg-success/15 text-success border-success/30",
  PAST_DUE: "bg-destructive/10 text-destructive border-destructive/30",
  CANCELLED: "bg-muted text-muted-foreground",
  SUSPENDED: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusLabel: Record<string, string> = {
  TRIAL: "Old trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment pending",
  CANCELLED: "Cancelled",
  SUSPENDED: "Suspended",
};

function daysLeft(iso: string | null) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function SubscriptionPage() {
  const { business, role } = useBusiness();
  const qc = useQueryClient();
  const cycle: Cycle = "YEARLY";
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const isOwner = role === "BUSINESS_OWNER" || role === "SUPER_ADMIN";

  const startUpi = useServerFn(startUpiPayment);
  const [upiPay, setUpiPay] = useState<UpiPayment | null>(null);
  const cancelFn = useServerFn(cancelSubscription);

  const subQuery = useQuery({
    queryKey: ["subscription", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "id, status, trial_ends_at, current_period_end, provider, plan_id, plans(id, code, name, price_monthly, price_yearly, max_branches, features)",
        )
        .eq("business_id", business!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const plansQuery = useQuery({
    queryKey: ["plans-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("id, code, name, price_monthly, price_yearly, original_price_yearly, max_branches, features, sort_order, duration_months, contact_only")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, currency, provider, status, invoice_number, created_at")
        .eq("business_id", business!.id)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  const branchCount = useQuery({
    queryKey: ["branch-count", business?.id],
    enabled: Boolean(business?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("branches")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelFn({ data: { businessId: business!.id } }),
    onSuccess: () => {
      toast.success("Plan cancelled. You keep access until the end of the paid period.");
      qc.invalidateQueries({ queryKey: ["subscription", business?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sub = subQuery.data;
  const currentPlan = sub?.plans ?? null;
  const trialDays = sub?.status === "TRIAL" ? daysLeft(sub.trial_ends_at) : null;

  async function upgrade(planId: string) {
    if (!business) return;
    setBusyPlan(planId);
    try {
      const res = await startUpi({ data: { businessId: business.id, planId, cycle } });
      setUpiPay(res);
      qc.invalidateQueries({ queryKey: ["payments", business.id] });
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) window.location.href = res.upiUrl;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyPlan(null);
    }
  }

  if (!business) return null;

  return (
    <>
      <PageHeader
        title="Subscription"
        description="Your plan, expiry date, payments and invoices."
      />

      {subQuery.isLoading ? (
        <Skeleton className="h-36 w-full rounded-2xl" />
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="surface p-5 md:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Current plan</p>
                <p className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
                  <Crown className="size-5 text-primary" />
                  {currentPlan?.name ?? "No plan"}
                </p>
              </div>
              {sub ? (
                <Badge variant="outline" className={cn("capitalize", statusTone[sub.status])}>
                  {statusLabel[sub.status] ?? sub.status}
                </Badge>
              ) : null}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {currentPlan
                ? `Up to ${currentPlan.max_branches >= 999 ? "unlimited" : currentPlan.max_branches} branch${currentPlan.max_branches === 1 ? "" : "es"} · using ${branchCount.data ?? 0}`
                : "Pick a plan below to get started."}
            </p>
            {isOwner && sub && sub.status !== "CANCELLED" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-4">
                    Cancel plan
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this plan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You keep access until the end of the current period. Your customers, stamps
                      and rewards stay safe.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep plan</AlertDialogCancel>
                    <AlertDialogAction onClick={() => cancelMutation.mutate()}>
                      Cancel plan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
          <StatCard
            label="Plan status"
            value={sub ? statusLabel[sub.status] ?? sub.status : "Not active"}
            icon={ShieldAlert}
            hint={trialDays !== null ? `${trialDays} day(s) left` : sub?.status === "ACTIVE" ? "Paid and verified" : "Activates after payment is verified"}
          />
          <StatCard
            label="Expires on"
            value={
              sub?.current_period_end
                ? new Date(sub.current_period_end).toLocaleDateString()
                : "—"
            }
            icon={CreditCard}
            hint={sub?.provider ? `Paid with ${sub.provider}` : "No payment yet"}
          />
        </div>
      )}

      <UpiPayDialog
        payment={upiPay}
        onClose={() => setUpiPay(null)}
        onSubmitted={() => qc.invalidateQueries({ queryKey: ["payments", business.id] })}
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Plans</h2>
        <Badge variant="secondary">Same features — pick your duration</Badge>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {plansQuery.isLoading
          ? Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))
          : plansQuery.data?.map((plan) => {
              const isCurrent = currentPlan?.id === plan.id;
              const price = Number(plan.price_yearly);
              const original = Number((plan as { original_price_yearly?: number | null }).original_price_yearly ?? 0);
              const enterprise = plan.contact_only || plan.code === "ENTERPRISE";
              const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
              return (
                <div
                  key={plan.id}
                  className={cn("surface flex flex-col p-5", isCurrent && "ring-2 ring-primary")}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold">{plan.name}</h3>
                    {isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                  </div>
                  <p className="mt-3 text-3xl font-extrabold">
                    {enterprise ? (
                      <span className="text-xl">Contact for pricing</span>
                    ) : (
                      <>
                        {original > price ? (
                          <span className="mr-2 text-lg font-semibold text-muted-foreground line-through">{inr(original)}</span>
                        ) : null}
                        {inr(price)}
                        <span className="text-sm font-medium text-muted-foreground"> / {plan.duration_months} months</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.max_branches >= 999 ? "Unlimited branches" : `${plan.max_branches} branch${plan.max_branches === 1 ? "" : "es"}`}
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  {enterprise ? (
                    <Button variant="outline" className="mt-5" asChild>
                      <a href="/contact">Contact sales</a>
                    </Button>
                  ) : (
                    <Button
                      className="mt-5"
                      disabled={!isOwner || busyPlan === plan.id}
                      onClick={() => upgrade(plan.id)}
                    >
                      {isCurrent
                        ? "Renew this plan"
                        : busyPlan === plan.id
                          ? "Opening payment…"
                          : `Choose ${plan.name}`}
                    </Button>
                  )}
                  {!isOwner && !enterprise ? (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Only the owner can change the plan.
                    </p>
                  ) : null}
                </div>
              );
            })}
      </div>

      <h2 className="mt-8 text-lg font-bold">Payments</h2>
      {paymentsQuery.isLoading ? (
        <Skeleton className="mt-4 h-40 w-full rounded-2xl" />
      ) : (paymentsQuery.data ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Receipt}
            title="No payments yet"
            description="Your receipts will appear here after your first plan payment."
          />
        </div>
      ) : (
        <div className="surface mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Paid with</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {paymentsQuery.data!.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.invoice_number ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">{inr(Number(p.amount))}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{p.provider}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        p.status === "SUCCESS" && "border-success/30 bg-success/15 text-success",
                        p.status === "FAILED" &&
                          "border-destructive/30 bg-destructive/10 text-destructive",
                      )}
                    >
                      {p.status === "SUCCESS"
                        ? "Paid"
                        : p.status === "PENDING"
                          ? "Pending"
                          : p.status === "FAILED"
                            ? "Failed"
                            : p.status === "VERIFICATION_REQUIRED"
                              ? "Verification required"
                              : p.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <InvoicesSection businessId={business.id} />
    </>
  );
}

function InvoicesSection({ businessId }: { businessId: string }) {
  const q = useQuery({
    queryKey: ["invoices", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <>
      <h2 className="mt-8 text-lg font-bold">Invoices &amp; Billing</h2>
      {q.isLoading ? (
        <Skeleton className="mt-4 h-32 w-full rounded-2xl" />
      ) : (q.data ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={Receipt} title="No invoices yet" description="An invoice is created automatically once your payment is verified." />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {q.data!.map((inv) => (
            <div key={inv.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{inv.invoice_number} · {new Date(inv.created_at).toLocaleDateString()}</p>
                <p className="font-semibold">{inv.item_name}</p>
                <p className="text-xs text-muted-foreground">{inr(Number(inv.total))} · {inv.method} · <span className="text-success">Paid</span></p>
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadInvoicePdf(inv as any)}>Download PDF</Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
