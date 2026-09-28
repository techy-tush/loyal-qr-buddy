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

export const Route = createFileRoute("/_authenticated/subscription")({
  head: () => ({
    meta: [
      { title: "Subscription | Digital Udyam" },
      {
        name: "description",
        content:
          "See your current plan, trial days left, renewal date and every payment receipt, and upgrade whenever you need more branches.",
      },
      { property: "og:title", content: "Subscription | Digital Udyam" },
      {
        property: "og:description",
        content: "Manage your Digital Udyam plan, trial, renewals and payment history.",
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
  TRIAL: "Free trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment due",
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
  const [cycle, setCycle] = useState<Cycle>("MONTHLY");
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
        .select("id, code, name, price_monthly, price_yearly, max_branches, features, sort_order")
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
        description="Your plan, trial, renewal date and payment receipts."
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
            label="Trial remaining"
            value={trialDays === null ? "—" : `${trialDays} day${trialDays === 1 ? "" : "s"}`}
            icon={ShieldAlert}
            hint={sub?.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString() : "No trial running"}
          />
          <StatCard
            label="Renews on"
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
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {(["MONTHLY", "YEARLY"] as Cycle[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {c === "MONTHLY" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plansQuery.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-2xl" />
            ))
          : plansQuery.data?.map((plan) => {
              const isCurrent = currentPlan?.id === plan.id;
              const price = cycle === "YEARLY" ? Number(plan.price_yearly) : Number(plan.price_monthly);
              const enterprise = plan.code === "ENTERPRISE";
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
                    {enterprise || price <= 0 ? (
                      "Custom"
                    ) : (
                      <>
                        {inr(price)}
                        <span className="text-sm font-medium text-muted-foreground">
                          /{cycle === "YEARLY" ? "year" : "month"}
                        </span>
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
                      disabled={
                        !isOwner ||
                        isCurrent ||
                        busyPlan === plan.id
                      }
                      onClick={() => upgrade(plan.id)}
                    >
                      {isCurrent
                        ? "Your plan"
                        : busyPlan === plan.id
                          ? "Opening payment…"
                          : `Upgrade to ${plan.name}`}
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
                            : p.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
