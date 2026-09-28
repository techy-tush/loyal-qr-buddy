import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Inbox, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { decideVisit } from "@/lib/staff.functions";

export function VisitApprovals({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const decideFn = useServerFn(decideVisit);
  const list = useQuery({
    queryKey: ["visit-requests", businessId],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visit_requests")
        .select("id, created_at, customers(full_name, phone, total_visits)")
        .eq("business_id", businessId)
        .eq("status", "PENDING")
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  const decide = useMutation({
    mutationFn: (v: { requestId: string; approve: boolean }) => decideFn({ data: v }),
    onSuccess: (res) => {
      if (!res.approved) toast("Request rejected.");
      else if (res.rewardUnlocked) toast.success(`Approved — reward unlocked! Code ${res.rewardCode}`);
      else toast.success("Visit approved.");
      queryClient.invalidateQueries({ queryKey: ["visit-requests", businessId] });
      queryClient.invalidateQueries({ queryKey: ["metrics", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = list.data ?? [];

  return (
    <section className="surface mb-6 p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">Pending approvals</h2>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-primary">{rows.length}</span>
      </div>
      {list.isLoading ? (
        <Skeleton className="h-20" />
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
          <Inbox className="size-5" /> No requests right now. When a customer scans your QR, it shows up here.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const c = Array.isArray(r.customers) ? r.customers[0] : r.customers;
            return (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c?.full_name ?? "Customer"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c?.phone} · {c?.total_visits ?? 0} visits · {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Button size="sm" variant="outline" aria-label="Reject" disabled={decide.isPending} onClick={() => decide.mutate({ requestId: r.id, approve: false })}>
                  <X className="size-4" />
                </Button>
                <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ requestId: r.id, approve: true })}>
                  <Check className="size-4" /> Approve
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
