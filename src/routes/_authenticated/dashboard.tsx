import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, QrCode, Repeat, Stamp, UserPlus, Users, BadgeCheck } from "lucide-react";
import { AppShell, PageHeader, StatCard } from "@/components/app/AppShell";
import { AreaTrend, BarTrend, LineTrend } from "@/components/app/Charts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusiness } from "@/hooks/use-business";
import { fetchBusinessMetrics } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";

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
  const businessId = business!.id;

  const metrics = useQuery({
    queryKey: ["metrics", businessId],
    queryFn: () => fetchBusinessMetrics(businessId, 30),
  });

  const activity = useQuery({
    queryKey: ["recent-activity", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, entity, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <PageHeader
        title={`Welcome back, ${business!.name}`}
        description="Last 30 days of loyalty activity."
        action={
          <Button asChild>
            <Link to="/qr-codes">
              <QrCode className="mr-1.5 size-4" /> QR codes
            </Link>
          </Button>
        }
      />

      {metrics.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : metrics.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            {activity.data!.map((row) => (
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
