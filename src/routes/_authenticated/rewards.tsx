import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Gift, Plus, XCircle } from "lucide-react";
import { AppShell, EmptyState, PageHeader, StatCard } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";
import { cancelReward, grantReward, redeemReward } from "@/lib/staff.functions";

export const Route = createFileRoute("/_authenticated/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards | Digital Udyam" },
      {
        name: "description",
        content: "Track every reward your customers unlock, redeem codes and issue goodwill rewards.",
      },
      { property: "og:title", content: "Rewards | Digital Udyam" },
      {
        property: "og:description",
        content: "Unlocked, redeemed and expired rewards with one-time secure codes.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <RewardsPage />
    </AppShell>
  ),
});

const STATUSES = ["ALL", "AVAILABLE", "REDEEMED", "EXPIRED", "CANCELLED"] as const;
type Status = (typeof STATUSES)[number];
const PAGE_SIZE = 20;

function RewardsPage() {
  const { business, role } = useBusiness();
  const businessId = business!.id;
  const queryClient = useQueryClient();
  const isAdmin = role === "BUSINESS_OWNER" || role === "BUSINESS_MANAGER" || role === "SUPER_ADMIN";

  const status = "ALL" as Status;
  const [page, setPage] = useState(0);
  const [code, setCode] = useState("");
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({ phone: "", description: "", expiryDays: "30" });

  const redeemFn = useServerFn(redeemReward);
  const grantFn = useServerFn(grantReward);
  const cancelFn = useServerFn(cancelReward);

  const rewards = useQuery({
    queryKey: ["rewards", businessId, status, page],
    queryFn: async () => {
      let q = supabase
        .from("rewards")
        .select(
          "id, code, description, status, source, created_at, expires_at, redeemed_at, customer:customers(id, full_name, phone)",
          { count: "exact" },
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (status !== "ALL") q = q.eq("status", status);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const counts = useQuery({
    queryKey: ["reward-counts", businessId],
    queryFn: async () => {
      const entries = await Promise.all(
        (["AVAILABLE", "REDEEMED", "EXPIRED", "CANCELLED"] as const).map(async (s) => {
          const { count } = await supabase
            .from("rewards")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessId)
            .eq("status", s);
          return [s, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["rewards", businessId] });
    queryClient.invalidateQueries({ queryKey: ["reward-counts", businessId] });
  };

  const redeem = useMutation({
    mutationFn: (value: string) => redeemFn({ data: { businessId, code: value } }),
    onSuccess: (res) => {
      toast.success(`Redeemed “${res.description}” for ${res.customerName}`);
      setCode("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grant = useMutation({
    mutationFn: async () => {
      const { data: customer, error } = await supabase
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("phone", grantForm.phone.trim())
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!customer) throw new Error("No customer found with that phone number.");
      return grantFn({
        data: {
          businessId,
          customerId: customer.id,
          description: grantForm.description.trim(),
          expiryDays: Number(grantForm.expiryDays) || 30,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Reward created — code ${res.code}`);
      setGrantOpen(false);
      setGrantForm({ phone: "", description: "", expiryDays: "30" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: (rewardId: string) => cancelFn({ data: { businessId, rewardId } }),
    onSuccess: () => {
      toast.success("Reward cancelled");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = rewards.data?.rows ?? [];
  const total = rewards.data?.count ?? 0;
  const c = counts.data ?? {};

  const grantDialog = (
    <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
      <DialogTrigger asChild>
        <Button disabled={!isAdmin}>
          <Plus className="mr-1.5 size-4" /> Issue reward
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue a reward</DialogTitle>
          <DialogDescription>
            Creates a one-time code the customer can show at the counter.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="g-phone">Customer mobile number</Label>
            <Input
              id="g-phone"
              maxLength={20}
              value={grantForm.phone}
              onChange={(e) => setGrantForm({ ...grantForm, phone: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-desc">Reward</Label>
            <Input
              id="g-desc"
              maxLength={160}
              placeholder="Free cappuccino"
              value={grantForm.description}
              onChange={(e) => setGrantForm({ ...grantForm, description: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="g-exp">Valid for (days)</Label>
            <Input
              id="g-exp"
              type="number"
              min={1}
              max={365}
              value={grantForm.expiryDays}
              onChange={(e) => setGrantForm({ ...grantForm, expiryDays: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => grant.mutate()}
            disabled={
              grant.isPending ||
              grantForm.phone.trim().length < 4 ||
              grantForm.description.trim().length < 2
            }
          >
            {grant.isPending ? "Creating…" : "Create reward"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div>
      <PageHeader
        title="Rewards"
        description="Everyone who won a reward. Tap Redeem when they claim it."
        action={grantDialog}
      />

      <div className="mb-6 grid gap-4 grid-cols-2">
        <StatCard label="Waiting to be redeemed" value={c["AVAILABLE"] ?? 0} icon={Gift} />
        <StatCard label="Redeemed" value={c["REDEEMED"] ?? 0} icon={BadgeCheck} />
      </div>

      <div className="surface mb-6 p-5">
        <p className="mb-3 text-sm font-semibold">Redeem a reward code</p>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            redeem.mutate(code);
          }}
        >
          <Input
            placeholder="e.g. 4F9A2B7C"
            maxLength={32}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="max-w-xs font-mono tracking-widest"
          />
          <Button type="submit" disabled={redeem.isPending || code.trim().length < 4}>
            {redeem.isPending ? "Checking…" : "Redeem"}
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          The code is verified on the server: right business, not expired, not already used.
        </p>
      </div>


      {rewards.isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No rewards yet"
          description="Once a customer fills their stamp card, their reward appears here automatically."
        />
      ) : (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const customer = r.customer as { full_name: string; phone: string } | null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono font-semibold">{r.code}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{customer?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{customer?.phone}</p>
                    </TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "AVAILABLE"
                            ? "default"
                            : r.status === "REDEEMED"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {r.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "AVAILABLE" ? (
                        <Button size="sm" onClick={() => redeem.mutate(r.code)} disabled={redeem.isPending}>
                          <BadgeCheck className="mr-1.5 size-4" /> Redeem
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
