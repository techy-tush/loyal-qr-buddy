import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { AppShell, EmptyState, PageHeader, StatCard } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/feedback")({
  head: () => ({
    meta: [
      { title: "Feedback | Digital Udyam" },
      {
        name: "description",
        content: "See every rating and comment your customers leave after a visit.",
      },
      { property: "og:title", content: "Feedback | Digital Udyam" },
      {
        property: "og:description",
        content: "Average rating, review counts and the latest customer comments in one place.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <FeedbackPage />
    </AppShell>
  ),
});

const PAGE_SIZE = 20;

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            n <= value ? "size-4 fill-warning text-warning" : "size-4 text-muted-foreground/40"
          }
        />
      ))}
    </span>
  );
}

function FeedbackPage() {
  const { business, branches } = useBusiness();
  const businessId = business!.id;
  const [rating, setRating] = useState<string>("ALL");
  const [page, setPage] = useState(0);

  const stats = useQuery({
    queryKey: ["feedback-stats", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("rating")
        .eq("business_id", businessId);
      if (error) throw error;
      const total = data.length;
      const sum = data.reduce((acc, r) => acc + r.rating, 0);
      const counts = [1, 2, 3, 4, 5].map(
        (n) => data.filter((r) => r.rating === n).length,
      );
      return {
        total,
        average: total ? sum / total : 0,
        promoters: data.filter((r) => r.rating >= 4).length,
        detractors: data.filter((r) => r.rating <= 2).length,
        counts,
      };
    },
  });

  const list = useQuery({
    queryKey: ["feedback", businessId, rating, page],
    queryFn: async () => {
      let query = supabase
        .from("feedback")
        .select("id, rating, comment, created_at, branch_id, customers(full_name, phone)", {
          count: "exact",
        })
        .eq("business_id", businessId);
      if (rating !== "ALL") query = query.eq("rating", Number(rating));
      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const rows = list.data?.rows ?? [];
  const count = list.data?.count ?? 0;
  const s = stats.data;

  return (
    <div>
      <PageHeader
        title="Feedback"
        description="Ratings and comments customers leave from their loyalty card."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Average rating"
          value={s ? s.average.toFixed(1) : "0.0"}
          icon={Star}
        />
        <StatCard label="Total reviews" value={s?.total ?? 0} icon={MessageSquare} />
        <StatCard label="Happy (4–5 stars)" value={s?.promoters ?? 0} />
        <StatCard label="Needs attention (1–2)" value={s?.detractors ?? 0} />
      </div>

      {s && s.total > 0 ? (
        <div className="surface mb-6 p-5">
          <p className="mb-3 text-sm font-medium">Rating breakdown</p>
          <div className="grid gap-2">
            {[5, 4, 3, 2, 1].map((n) => {
              const value = s.counts[n - 1] ?? 0;
              const pct = s.total ? Math.round((value / s.total) * 100) : 0;
              return (
                <div key={n} className="flex items-center gap-3 text-xs">
                  <span className="w-10 text-muted-foreground">{n} star</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-12 text-right text-muted-foreground">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {["ALL", "5", "4", "3", "2", "1"].map((r) => (
          <Button
            key={r}
            size="sm"
            variant={rating === r ? "default" : "outline"}
            onClick={() => {
              setRating(r);
              setPage(0);
            }}
          >
            {r === "ALL" ? "All reviews" : `${r} star`}
          </Button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No feedback yet"
          description="Customers can rate their visit from their loyalty card — share your QR code to collect your first review."
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => {
            const customer = row.customers as { full_name: string; phone: string } | null;
            return (
              <div key={row.id} className="surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Stars value={row.rating} />
                    <span className="text-sm font-medium">
                      {customer?.full_name ?? "Walk-in customer"}
                    </span>
                    {customer?.phone ? (
                      <span className="text-xs text-muted-foreground">{customer.phone}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {row.branch_id ? (
                      <Badge variant="secondary">
                        {branches.find((b) => b.id === row.branch_id)?.name ?? "Branch"}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                {row.comment ? (
                  <p className="mt-3 text-sm text-muted-foreground">{row.comment}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {count > PAGE_SIZE ? (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min(count, (page + 1) * PAGE_SIZE)} of {count}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={(page + 1) * PAGE_SIZE >= count}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
