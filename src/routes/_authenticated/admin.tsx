import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  IndianRupee,
  LifeBuoy,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState, StatCard } from "@/components/app/AppShell";
import { Logo } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  changeBusinessPlan,
  getPlatformOverview,
  isPlatformAdmin,
  listBusinessesAdmin,
  getBusinessDetailAdmin,
  listPaymentsAdmin,
  decideUpiPayment,
  saveUpiSettings,
  listPlansAdmin,
  listSubscriptionsAdmin,
  listTicketsAdmin,
  listUsersAdmin,
  replyTicketAdmin,
  savePlanAdmin,
  setBusinessStatus,
  setSuperAdmin,
} from "@/lib/admin.functions";
import { cn } from "@/lib/utils";
import { CreateUserTab, InvoicesTab, ManageSubscriptionDialog, ManualPaymentDialog } from "@/components/app/AdminBilling";
import { useBusiness } from "@/hooks/use-business";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Platform admin | Digital Udyam" },
      {
        name: "description",
        content:
          "Platform control room: every business, owner, plan, subscription, payment and support request in one place.",
      },
      { property: "og:title", content: "Platform admin | Digital Udyam" },
      {
        property: "og:description",
        content: "Activate or suspend businesses, change plans and track platform revenue.",
      },
    ],
  }),
  component: AdminPage,
});

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const SUB_STATUSES = ["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "SUSPENDED"] as const;

const statusTone: Record<string, string> = {
  ACTIVE: "border-success/30 bg-success/15 text-success",
  TRIAL: "border-warning/30 bg-warning/15 text-warning",
  PENDING: "border-warning/30 bg-warning/15 text-warning",
  SUSPENDED: "border-destructive/30 bg-destructive/10 text-destructive",
  PAST_DUE: "border-destructive/30 bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
};

function AdminPage() {
  const gate = useQuery({ queryKey: ["is-platform-admin"], queryFn: () => isPlatformAdmin() });

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (gate.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-24 w-64 rounded-2xl" />
      </div>
    );
  }

  if (!gate.data?.allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <Logo />
        <h1 className="text-xl font-bold">Platform team only</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This area is reserved for Digital Udyam platform administrators.
        </p>
        <Button asChild>
          <Link to="/dashboard">Back to my dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
        <Logo to="/admin" />
        <Badge variant="outline" className="ml-1 gap-1">
          <ShieldCheck className="size-3" /> Platform admin
        </Badge>
        <div className="flex-1" />
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard">My business</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </header>

      <div className="p-4 md:p-6">
        <h1 className="text-2xl font-extrabold">Platform control room</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every business, owner, plan, subscription and payment across Digital Udyam.
        </p>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="businesses">Businesses</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="create">Create user</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="businesses" className="mt-5">
            <BusinessesTab />
          </TabsContent>
          <TabsContent value="users" className="mt-5">
            <UsersTab />
          </TabsContent>
          <TabsContent value="plans" className="mt-5">
            <PlansTab />
          </TabsContent>
          <TabsContent value="subscriptions" className="mt-5">
            <SubscriptionsTab />
          </TabsContent>
          <TabsContent value="payments" className="mt-5">
            <PaymentsTab />
          </TabsContent>
          <TabsContent value="invoices" className="mt-5">
            <InvoicesTab />
          </TabsContent>
          <TabsContent value="create" className="mt-5">
            <CreateUserTab />
          </TabsContent>
          <TabsContent value="support" className="mt-5">
            <SupportTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OverviewTab() {
  const q = useQuery({ queryKey: ["platform-overview"], queryFn: () => getPlatformOverview() });
  if (q.isLoading)
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  const d = q.data!;
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Businesses" value={d.businesses} icon={Building2} hint={`${d.active} active`} />
        <StatCard label="Old trials" value={d.trial} icon={ShieldCheck} hint={`${d.pending} pending setup`} />
        <StatCard label="Paying businesses" value={d.paidSubs} icon={CreditCard} hint={`${d.cancelled} cancelled`} />
        <StatCard label="Suspended" value={d.suspended} icon={Building2} />
        <StatCard label="Customers" value={d.customers} icon={Users} />
        <StatCard label="QR scans" value={d.scans} hint={`${d.stamps} stamps issued`} />
        <StatCard label="Rewards created" value={d.rewards} />
        <StatCard
          label="Revenue collected"
          value={inr(d.revenue)}
          icon={IndianRupee}
          hint={`${inr(d.revenue30)} in the last 30 days`}
        />
      </div>
      {d.openTickets > 0 ? (
        <div className="surface mt-4 flex items-center gap-3 border-warning/40 bg-warning/10 p-4 text-sm">
          <LifeBuoy className="size-4 text-warning" />
          {d.openTickets} support request{d.openTickets === 1 ? "" : "s"} waiting for a reply.
        </div>
      ) : null}
    </>
  );
}

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

function Pager({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {total} total · page {page + 1} of {pages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function BusinessesTab() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const list = useServerFn(listBusinessesAdmin);
  const setStatus = useServerFn(setBusinessStatus);
  const changePlan = useServerFn(changeBusinessPlan);

  const q = useQuery({
    queryKey: ["admin-businesses", search, page],
    queryFn: () => list({ data: { search, page } }),
  });
  const plans = useQuery({ queryKey: ["admin-plans"], queryFn: () => listPlansAdmin() });

  const statusMutation = useMutation({
    mutationFn: (v: { businessId: string; status: "ACTIVE" | "SUSPENDED" | "PENDING" }) =>
      setStatus({ data: v }),
    onSuccess: () => {
      toast.success("Business updated.");
      qc.invalidateQueries({ queryKey: ["admin-businesses"] });
      qc.invalidateQueries({ queryKey: ["platform-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [planTarget, setPlanTarget] = useState<{ id: string; name: string } | null>(null);
  const [planId, setPlanId] = useState("");
  const [subStatus, setSubStatus] = useState<(typeof SUB_STATUSES)[number]>("ACTIVE");

  const planMutation = useMutation({
    mutationFn: () =>
      changePlan({ data: { businessId: planTarget!.id, planId, status: subStatus } }),
    onSuccess: () => {
      toast.success("Plan changed.");
      setPlanTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-businesses"] });
      qc.invalidateQueries({ queryKey: ["platform-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search by name or city" />

      {q.isLoading ? (
        <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
      ) : (q.data?.rows.length ?? 0) === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={Building2}
            title="No businesses yet"
            description="Businesses appear here as soon as owners finish their setup."
          />
        </div>
      ) : (
        <>
          <div className="surface mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Business</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Customers</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {q.data!.rows.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[b.category, b.city].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{b.ownerName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{b.ownerEmail ?? ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{b.planName ?? "No plan"}</p>
                      {b.subStatus ? (
                        <Badge variant="outline" className={cn("mt-1", statusTone[b.subStatus])}>
                          {b.subStatus.replace("_", " ").toLowerCase()}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{b.customers}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusTone[b.status]}>
                        {b.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setDetailId(b.id)}>
                          Open
                        </Button>
                        {b.status === "SUSPENDED" ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              statusMutation.mutate({ businessId: b.id, status: "ACTIVE" })
                            }
                          >
                            Activate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              statusMutation.mutate({ businessId: b.id, status: "SUSPENDED" })
                            }
                          >
                            Suspend
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPlanTarget({ id: b.id, name: b.name });
                            setPlanId(plans.data?.[0]?.id ?? "");
                            setSubStatus("ACTIVE");
                          }}
                        >
                          Change plan
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={q.data!.total} onPage={setPage} />
        </>
      )}

      <BusinessDetailDialog id={detailId} onClose={() => setDetailId(null)} />
      <Dialog open={Boolean(planTarget)} onOpenChange={(o) => !o && setPlanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>{planTarget?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Billing status</Label>
              <Select value={subStatus} onValueChange={(v) => setSubStatus(v as typeof subStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUB_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ").toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!planId || planMutation.isPending}
              onClick={() => planMutation.mutate()}
            >
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const list = useServerFn(listUsersAdmin);
  const setAdmin = useServerFn(setSuperAdmin);

  const q = useQuery({
    queryKey: ["admin-users", search, page],
    queryFn: () => list({ data: { search, page } }),
  });

  const roleMutation = useMutation({
    mutationFn: (v: { userId: string; grant: boolean }) => setAdmin({ data: v }),
    onSuccess: () => {
      toast.success("Access updated.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Search by name or email" />
      {q.isLoading ? (
        <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
      ) : (q.data?.rows.length ?? 0) === 0 ? (
        <div className="mt-4">
          <EmptyState icon={Users} title="No users found" description="Try a different search." />
        </div>
      ) : (
        <>
          <div className="surface mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Owns</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Platform admin</th>
                </tr>
              </thead>
              <tbody>
                {q.data!.rows.map((u) => {
                  const isAdmin = u.roles.includes("SUPER_ADMIN");
                  return (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3 font-semibold">{u.full_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <p>{u.email ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.mobile ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.businesses.length ? u.businesses.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={isAdmin}
                          onCheckedChange={(v) => roleMutation.mutate({ userId: u.id, grant: v })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={q.data!.total} onPage={setPage} />
        </>
      )}
    </>
  );
}

function PlansTab() {
  const qc = useQueryClient();
  const save = useServerFn(savePlanAdmin);
  const q = useQuery({ queryKey: ["admin-plans"], queryFn: () => listPlansAdmin() });
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ monthly: "", yearly: "", branches: "", active: true });

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          planId: editing!,
          priceMonthly: Number(form.monthly),
          priceYearly: Number(form.yearly),
          maxBranches: Number(form.branches),
          isActive: form.active,
        },
      }),
    onSuccess: () => {
      toast.success("Plan saved.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      qc.invalidateQueries({ queryKey: ["plans-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {q.data?.map((p) => (
        <div key={p.id} className="surface flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">{p.name}</h3>
            <Badge variant="outline" className={p.is_active ? statusTone["ACTIVE"] : ""}>
              {p.is_active ? "live" : "hidden"}
            </Badge>
          </div>
          <p className="mt-3 text-2xl font-extrabold">
            {inr(Number(p.price_monthly))}
            <span className="text-sm font-medium text-muted-foreground">/month</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {inr(Number(p.price_yearly))}/year ·{" "}
            {p.max_branches >= 999 ? "unlimited branches" : `${p.max_branches} branches`}
          </p>
          <Dialog
            open={editing === p.id}
            onOpenChange={(o) => {
              if (o) {
                setEditing(p.id);
                setForm({
                  monthly: String(p.price_monthly),
                  yearly: String(p.price_yearly),
                  branches: String(p.max_branches),
                  active: p.is_active,
                });
              } else setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="mt-4">
                Edit plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit {p.name}</DialogTitle>
                <DialogDescription>
                  Changes apply to new checkouts right away.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Monthly price (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.monthly}
                    onChange={(e) => setForm({ ...form, monthly: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Yearly price (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.yearly}
                    onChange={(e) => setForm({ ...form, yearly: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Branches included</Label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={form.branches}
                    onChange={(e) => setForm({ ...form, branches: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border p-3">
                  <span className="text-sm font-medium">Show on pricing page</span>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(v) => setForm({ ...form, active: v })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                  Save plan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ))}
    </div>
  );
}

function SubscriptionsTab() {
  const [page, setPage] = useState(0);
  const [manage, setManage] = useState<any | null>(null);
  const list = useServerFn(listSubscriptionsAdmin);
  const q = useQuery({
    queryKey: ["admin-subscriptions", page],
    queryFn: () => list({ data: { search: "", page } }),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if ((q.data?.rows.length ?? 0) === 0)
    return (
      <EmptyState
        icon={CreditCard}
        title="No subscriptions yet"
        description="Subscriptions appear when a business finishes setup or is created by an admin."
      />
    );

  return (
    <>
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Business</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Branches</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {q.data!.rows.map((s: any) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 font-semibold">{s.businesses?.name ?? "—"}</td>
                <td className="px-4 py-3">{s.plans?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={statusTone[s.status]}>
                    {s.status.replace("_", " ").toLowerCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3">{s.custom_max_branches ?? "plan"}</td>
                <td className="px-4 py-3">
                  {s.current_period_end
                    ? new Date(s.current_period_end).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => setManage(s)}>Manage</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={q.data!.total} onPage={setPage} />
      <ManageSubscriptionDialog sub={manage} onClose={() => setManage(null)} />
    </>
  );
}

function PaymentsTab() {
  const [manualOpen, setManualOpen] = useState(false);
  const [convert, setConvert] = useState<any | null>(null);
  const [page, setPage] = useState(0);
  const qc = useQueryClient();
  const list = useServerFn(listPaymentsAdmin);
  const decideFn = useServerFn(decideUpiPayment);
  const decide = useMutation({
    mutationFn: (v: { paymentId: string; approve: boolean }) => decideFn({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.approve ? "Payment confirmed — plan activated." : "Payment rejected.");
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const q = useQuery({
    queryKey: ["admin-payments", page],
    queryFn: () => list({ data: { search: "", page } }),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if ((q.data?.rows.length ?? 0) === 0)
    return (
      <>
      <UpiSettingsCard />
      <AddonPricingCard />
      <EmptyState
        icon={IndianRupee}
        title="No payments yet"
        description="Plan payments made by businesses will be listed here."
      />
      </>
    );

  return (
    <>
      <UpiSettingsCard />
      <AddonPricingCard />
      <div className="mb-3 flex justify-end"><Button size="sm" onClick={() => setManualOpen(true)}>Record manual payment</Button></div>
      <ManualPaymentDialog open={manualOpen || Boolean(convert)} convert={convert} onClose={() => { setManualOpen(false); setConvert(null); }} />
      <div className="surface overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Business</th>
              <th className="px-4 py-3 font-medium">Invoice</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Plan / UTR</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {q.data!.rows.map((p: any) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-semibold">{p.businesses?.name ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.invoice_number ?? "—"}</td>
                <td className="px-4 py-3">{inr(Number(p.amount))}</td>
                <td className="px-4 py-3 text-xs">
                  <p>{p.addon_code ? `Add-on: ${p.addon_code === "REVIEW_WRITER" ? "AI Review Writer" : "Digital Menu"}` : p.plans?.name ?? "—"} · {p.provider}</p>
                  <p className="font-mono text-muted-foreground">{p.provider_ref ?? "no UTR yet"}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      p.status === "SUCCESS" && statusTone["ACTIVE"],
                      p.status === "FAILED" && statusTone["SUSPENDED"],
                    )}
                  >
                    {p.status === "SUCCESS" ? "paid" : p.status.replace("_", " ").toLowerCase()}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {["PENDING", "VERIFICATION_REQUIRED"].includes(p.status) ? (
                    <div className="flex justify-end gap-2">
                      {p.method !== "MANUAL" ? <Button size="sm" variant="ghost" onClick={() => setConvert(p)}>To manual</Button> : null}
                      <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ paymentId: p.id, approve: false })}>Reject</Button>
                      <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ paymentId: p.id, approve: true })}>Confirm paid</Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} total={q.data!.total} onPage={setPage} />
    </>
  );
}

function SupportTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const list = useServerFn(listTicketsAdmin);
  const reply = useServerFn(replyTicketAdmin);
  const q = useQuery({
    queryKey: ["admin-tickets", page],
    queryFn: () => list({ data: { search: "", page } }),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED">("RESOLVED");

  const mutation = useMutation({
    mutationFn: () => reply({ data: { ticketId: openId!, reply: text, status } }),
    onSuccess: () => {
      toast.success("Reply saved.");
      setOpenId(null);
      setText("");
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      qc.invalidateQueries({ queryKey: ["platform-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if ((q.data?.rows.length ?? 0) === 0)
    return (
      <EmptyState
        icon={LifeBuoy}
        title="No support requests"
        description="Messages sent from the contact form and dashboard land here."
      />
    );

  return (
    <>
      <div className="space-y-3">
        {q.data!.rows.map((t: any) => (
          <div key={t.id} className="surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{t.subject}</p>
              <Badge variant="outline">{t.status.replace("_", " ").toLowerCase()}</Badge>
              <Badge variant="secondary">{t.priority.toLowerCase()}</Badge>
              <span className="text-xs text-muted-foreground">
                {t.businesses?.name ?? "Website visitor"} · {new Date(t.created_at).toLocaleString()}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{t.message}</p>
            {t.admin_reply ? (
              <p className="mt-3 rounded-xl bg-accent p-3 text-sm">
                <span className="font-semibold">Your reply: </span>
                {t.admin_reply}
              </p>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setOpenId(t.id);
                setText(t.admin_reply ?? "");
                setStatus(t.status === "OPEN" ? "RESOLVED" : t.status);
              }}
            >
              {t.admin_reply ? "Edit reply" : "Reply"}
            </Button>
          </div>
        ))}
      </div>
      <Pager page={page} total={q.data!.total} onPage={setPage} />

      <Dialog open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to support request</DialogTitle>
            <DialogDescription>The business owner sees this in their dashboard.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="space-y-2">
              <Label>Mark as</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ").toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={text.trim().length < 2 || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Save reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddonPricingCard() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-addons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("addons").select("code, name, price_yearly, is_active").order("code");
      if (error) throw error;
      return data;
    },
  });
  const save = useMutation({
    mutationFn: async (a: { code: string; price_yearly: number; is_active: boolean }) => {
      const { error } = await supabase.from("addons").update({ price_yearly: a.price_yearly, is_active: a.is_active }).eq("code", a.code);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Add-on updated."); qc.invalidateQueries({ queryKey: ["admin-addons"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="surface mb-5 p-5">
      <h3 className="text-sm font-semibold">Add-on pricing (per year)</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {(q.data ?? []).map((a) => (
          <form key={a.code} className="flex items-end gap-2" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({ code: a.code, price_yearly: Number(f.get("price")), is_active: f.get("active") === "on" });
          }}>
            <div className="flex-1 space-y-1.5"><Label>{a.name}</Label><Input name="price" type="number" min={1} defaultValue={Number(a.price_yearly)} /></div>
            <label className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" name="active" defaultChecked={a.is_active} /> Active</label>
            <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
          </form>
        ))}
      </div>
    </div>
  );
}

function UpiSettingsCard() {
  const saveFn = useServerFn(saveUpiSettings);
  const [upiId, setUpiId] = useState("");
  const [payee, setPayee] = useState("Digital Udyam");
  const current = useQuery({
    queryKey: ["platform-upi"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("key, value");
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!current.data) return;
    setUpiId(current.data.find((r) => r.key === "upi_id")?.value ?? "");
    setPayee(current.data.find((r) => r.key === "upi_payee_name")?.value || "Digital Udyam");
  }, [current.data]);
  const save = useMutation({
    mutationFn: () => saveFn({ data: { upiId, payee } }),
    onSuccess: () => toast.success("UPI details saved."),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form className="surface mb-5 grid gap-3 p-5 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <div className="space-y-1.5"><Label htmlFor="upi-id">Your UPI ID (plan payments go here)</Label><Input id="upi-id" placeholder="yourname@okaxis" value={upiId} onChange={(e) => setUpiId(e.target.value.trim())} /></div>
      <div className="space-y-1.5"><Label htmlFor="upi-payee">Name shown to payer</Label><Input id="upi-payee" value={payee} onChange={(e) => setPayee(e.target.value)} /></div>
      <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save UPI"}</Button>
    </form>
  );
}

function BusinessDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const fn = useServerFn(getBusinessDetailAdmin);
  const [search, setSearch] = useState("");
  const { setBusinessId } = useBusiness();
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["admin-business-detail", id, search],
    enabled: Boolean(id),
    queryFn: () => fn({ data: { businessId: id!, search } }),
  });
  const d = q.data;
  const b = d?.business;
  return (
    <Dialog open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{b?.name ?? "Business"}</DialogTitle>
          <DialogDescription>
            {[b?.category, b?.address, b?.city, b?.phone, b?.email].filter(Boolean).join(" · ") || "—"}
          </DialogDescription>
        </DialogHeader>
        {q.isLoading || !d ? (
          <Skeleton className="h-60" />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setBusinessId(id!);
                  onClose();
                  navigate({ to: "/dashboard" });
                }}
              >
                Log in as business owner
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ["Customers", d.counts.customers], ["Offers", d.counts.offers], ["Offer uses", d.counts.redemptions],
                ["Rewards", d.counts.rewards], ["QR scans", d.counts.scans], ["Visit requests", d.counts.visits],
                ["Branches", d.counts.branches],
              ] as const).map(([l, v]) => (
                <div key={l} className="rounded-xl border border-border p-3">
                  <p className="text-xl font-extrabold">{v}</p>
                  <p className="text-xs text-muted-foreground">{l}</p>
                </div>
              ))}
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Offers</h3>
              {d.offers.length === 0 ? <p className="text-sm text-muted-foreground">No offers.</p> : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {d.offers.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-medium">{o.title}</span>
                      <Badge variant="outline">{o.is_active ? "Live" : "Off"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Customers</h3>
                <Input className="h-8 max-w-48" placeholder="Search name / phone" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {d.customers.length === 0 ? <p className="text-sm text-muted-foreground">No customers.</p> : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {d.customers.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.full_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {c.phone}{c.email ? ` · ${c.email}` : ""} · {c.total_visits} visits · last {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString() : "—"}
                        </span>
                      </span>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/card/${c.access_token}`} target="_blank" rel="noreferrer">Open as customer</a>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
