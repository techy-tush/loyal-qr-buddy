import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, QrCode, Repeat, Stamp, UserPlus, Users, BadgeCheck, Clock3, Sparkles, Ticket } from "lucide-react";
import { AppShell, StatCard } from "@/components/app/AppShell";
import { AreaTrend, BarTrend, LineTrend } from "@/components/app/Charts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useBusiness } from "@/hooks/use-business";
import { fetchBusinessMetrics } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { VisitApprovals } from "@/components/app/VisitApprovals";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Digital Udyam" },
      { name: "description", content: "Track customers, QR scans, stamps and rewards in real time." },
      { property: "og:title", content: "Business dashboard | Digital Udyam" },
      { property: "og:description", content: "Your loyalty performance at a glance." },
    ],
  }),
  component: () => (
    <AppShell>
      <DashboardPage />
    </AppShell>
  ),
});

function DashboardPage() {
  const { business } = useBusiness();
  const businessId = business?.id;

  const metrics = useQuery({
    queryKey: ["metrics", businessId],
    enabled: Boolean(businessId),
    queryFn: () => fetchBusinessMetrics(businessId ?? "", 30),
  });

  const activity = useQuery({
    queryKey: ["recent-activity", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, entity, created_at")
        .eq("business_id", businessId ?? "")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  const subscription = useQuery({
    queryKey: ["dashboard-subscription", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, trial_ends_at, current_period_end, plans(name)")
        .eq("business_id", businessId ?? "")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (!business) return null;

  const sd = subscription.data;
  const until = sd?.status === "TRIAL" ? sd?.trial_ends_at : sd?.current_period_end;
  const planLive = Boolean(sd && ["TRIAL", "ACTIVE", "CANCELLED"].includes(sd.status) && until && new Date(until) > new Date());
  const plan = Array.isArray(subscription.data?.plans) ? subscription.data.plans[0]?.name : subscription.data?.plans?.name;
  const summary = metrics.data;

  return (
    <>
      <section className="dashboard-hero overflow-hidden rounded-lg px-4 py-5 shadow-lift md:px-6 md:py-6">
        {subscription.isSuccess && !planLive ? (
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-card/20 bg-card/10 p-3">
            <div className="flex min-w-0 items-center gap-2 text-xs font-semibold"><Clock3 className="size-4 shrink-0 text-sidebar-primary" /><span className="truncate">{sd?.status === "PAST_DUE" && !sd?.current_period_end ? "Payment pending — choose a plan to activate" : "Plan expired — renew to keep approving visits"}</span></div>
            <Button asChild size="sm" variant="secondary"><Link to="/subscription">Pay now</Link></Button>
          </div>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0"><p className="text-xs font-semibold text-card/70">WELCOME BACK</p><h1 className="mt-1 truncate text-2xl font-extrabold md:text-3xl">{business.name}</h1><p className="mt-1 text-sm text-card/70">{plan ?? "Business workspace"} · Last 30 days</p></div>
          <div className="grid size-12 shrink-0 place-items-center rounded-full border border-card/20 bg-card/10 font-display font-bold">{business.name.slice(0, 2).toUpperCase()}</div>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-2">
          {[["Scans", summary?.qrScans ?? 0], ["Customers", summary?.totalCustomers ?? 0], ["Rewards", summary?.rewardsEarned ?? 0], ["Repeat", `${summary?.repeatRate ?? 0}%`]].map(([label, value]) => (
            <div key={label} className="metric-tile rounded-md px-1 py-3 text-center md:p-4"><p className="text-lg font-extrabold md:text-2xl">{value}</p><p className="mt-1 truncate text-[9px] font-semibold uppercase text-card/60 md:text-[10px]">{label}</p></div>
          ))}
        </div>
      </section>

      <div className="mt-6"><VisitApprovals businessId={business.id} /></div>

      <section className="mb-6">
        <div className="mb-4"><h2 className="text-lg font-bold">Quick actions</h2><p className="text-sm text-muted-foreground">Keep customers coming back.</p></div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { to: "/offers" as const, label: "Create offer", hint: "Free item / discount", icon: Sparkles },
            { to: "/rewards" as const, label: "Redeem", hint: "Reward code", icon: Gift },
            { to: "/qr-codes" as const, label: "My QR", hint: "Print & share", icon: QrCode },
          ].map((action) => (
            <Link key={action.to} to={action.to} className="surface group flex min-w-0 flex-col items-center p-3 text-center transition hover:-translate-y-0.5 hover:shadow-soft md:flex-row md:items-center md:gap-3 md:text-left"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-primary"><action.icon className="size-5" /></span><span className="mt-2 min-w-0 md:mt-0"><span className="block truncate text-xs font-bold md:text-sm">{action.label}</span><span className="block text-[10px] text-muted-foreground md:text-xs">{action.hint}</span></span></Link>
          ))}
        </div>
      </section>

      {metrics.isLoading ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : metrics.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard label="Total customers" value={metrics.data.totalCustomers} icon={Users} />
            <StatCard label="New customers (30d)" value={metrics.data.newCustomers} icon={UserPlus} />
            <StatCard
              label="Repeat customers"
              value={metrics.data.repeatCustomers}
              icon={Repeat}
              hint={`${metrics.data.repeatRate}% repeat rate`}
            />
            <StatCard label="QR scans (30d)" value={metrics.data.qrScans} icon={QrCode} />
            <StatCard label="Stamps issued (30d)" value={metrics.data.stampsIssued} icon={Stamp} />
            <StatCard label="Rewards earned" value={metrics.data.rewardsEarned} icon={Gift} />
            <StatCard label="Rewards redeemed" value={metrics.data.rewardsRedeemed} icon={BadgeCheck} />
            <StatCard
              label="Average rating"
              value={metrics.data.totalReviews ? metrics.data.avgRating : "—"}
              hint={`${metrics.data.totalReviews} reviews`}
            />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <AreaTrend title="Customer growth" data={metrics.data.series.customers} />
            <BarTrend title="QR scans" data={metrics.data.series.scans} />
            <BarTrend title="Stamp activity" data={metrics.data.series.stamps} />
            <LineTrend title="Reward redemptions" data={metrics.data.series.rewards} />
          </div>
        </>
      ) : null}

      <div className="surface mt-6 p-5">
        <h3 className="text-sm font-semibold">Recent activity</h3>
        {activity.isLoading ? (
          <Skeleton className="mt-4 h-24" />
        ) : (activity.data ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No activity yet — share your QR code to get your first customer.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {(activity.data ?? []).map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium">{labelFor(row.action)}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function labelFor(action: string) {
  const map: Record<string, string> = {
    STAMP_ISSUED: "Stamp issued",
    REWARD_UNLOCKED: "Reward unlocked",
    REWARD_REDEEMED: "Reward redeemed",
    OFFER_REDEEMED: "Offer redeemed",
    CUSTOMER_JOINED: "New customer joined",
    SCRATCH_WIN: "Scratch card prize won",
  };
  return map[action] ?? action.replaceAll("_", " ").toLowerCase();
}
