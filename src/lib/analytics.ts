import { supabase } from "@/integrations/supabase/client";

export type Point = { date: string; value: number };

export function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function buildSeries(rows: { created_at: string }[], days: number): Point[] {
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    buckets.set(d, 0);
  }
  for (const row of rows) {
    const key = dayKey(row.created_at);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, value]) => ({
    date: date.slice(5),
    value,
  }));
}

export async function fetchBusinessMetrics(businessId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [customers, scans, stamps, rewards, offers, feedback] = await Promise.all([
    supabase
      .from("customers")
      .select("id, created_at, total_visits, last_visit_at")
      .eq("business_id", businessId),
    supabase.from("qr_scans").select("created_at").eq("business_id", businessId).gte("created_at", since),
    supabase.from("stamp_events").select("created_at").eq("business_id", businessId).gte("created_at", since),
    supabase.from("rewards").select("created_at, status").eq("business_id", businessId),
    supabase.from("offer_redemptions").select("created_at").eq("business_id", businessId).gte("created_at", since),
    supabase.from("feedback").select("rating").eq("business_id", businessId),
  ]);

  if (customers.error) throw customers.error;

  const allCustomers = customers.data ?? [];
  const newSince = allCustomers.filter((c) => c.created_at >= since).length;
  const repeat = allCustomers.filter((c) => (c.total_visits ?? 0) > 1).length;
  const inactive = allCustomers.filter(
    (c) => !c.last_visit_at || new Date(c.last_visit_at).getTime() < Date.now() - 30 * 86400000,
  ).length;
  const rewardRows = rewards.data ?? [];
  const ratings = (feedback.data ?? []).map((f) => f.rating);

  return {
    totalCustomers: allCustomers.length,
    newCustomers: newSince,
    repeatCustomers: repeat,
    inactiveCustomers: inactive,
    repeatRate: allCustomers.length ? Math.round((repeat / allCustomers.length) * 100) : 0,
    qrScans: (scans.data ?? []).length,
    stampsIssued: (stamps.data ?? []).length,
    rewardsEarned: rewardRows.length,
    rewardsRedeemed: rewardRows.filter((r) => r.status === "REDEEMED").length,
    rewardsAvailable: rewardRows.filter((r) => r.status === "AVAILABLE").length,
    offerRedemptions: (offers.data ?? []).length,
    avgRating: ratings.length
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0,
    totalReviews: ratings.length,
    series: {
      customers: buildSeries(
        allCustomers.filter((c) => c.created_at >= since).map((c) => ({ created_at: c.created_at })),
        days,
      ),
      scans: buildSeries(scans.data ?? [], days),
      stamps: buildSeries(stamps.data ?? [], days),
      rewards: buildSeries(
        rewardRows.filter((r) => r.created_at >= since).map((r) => ({ created_at: r.created_at })),
        days,
      ),
    },
  };
}
