import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Stamp } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { StampGrid } from "@/components/loyalty/StampGrid";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/loyalty")({
  head: () => ({
    meta: [
      { title: "Loyalty programs | Digital Udyam" },
      { name: "description", content: "Create digital stamp cards and reward rules for your business." },
      { property: "og:title", content: "Loyalty programs | Digital Udyam" },
      { property: "og:description", content: "Collect 10 stamps, get a free coffee — set it up in seconds." },
    ],
  }),
  component: () => (
    <AppShell>
      <LoyaltyPage />
    </AppShell>
  ),
});

function LoyaltyPage() {
  const { business } = useBusiness();
  const businessId = business!.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "Stamp & Save",
    stamps_required: 10,
    reward_type: "FREE_PRODUCT",
    reward_description: "FREE Coffee",
    reward_expiry_days: 30,
  });

  const programs = useQuery({
    queryKey: ["loyalty-programs", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_programs")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const stats = useQuery({
    queryKey: ["loyalty-stats", businessId],
    queryFn: async () => {
      const [cards, stamps, rewards] = await Promise.all([
        supabase.from("loyalty_cards").select("id, stamps").eq("business_id", businessId),
        supabase.from("stamp_events").select("id").eq("business_id", businessId),
        supabase.from("rewards").select("id, status").eq("business_id", businessId),
      ]);
      if (cards.error) throw cards.error;
      return {
        cards: cards.data.length,
        stamps: (stamps.data ?? []).length,
        available: (rewards.data ?? []).filter((r) => r.status === "AVAILABLE").length,
        redeemed: (rewards.data ?? []).filter((r) => r.status === "REDEEMED").length,
      };
    },
  });

  const createProgram = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("loyalty_programs").insert({
        business_id: businessId,
        name: form.name,
        stamps_required: form.stamps_required,
        reward_type: form.reward_type,
        reward_description: form.reward_description,
        reward_expiry_days: form.reward_expiry_days,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Loyalty program created");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["loyalty-programs", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleProgram = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("loyalty_programs").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["loyalty-programs", businessId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const stampMode = useMutation({
    mutationFn: async (mode: string) => {
      const { error } = await supabase.from("businesses").update({ stamp_mode: mode }).eq("id", businessId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stamping mode updated");
      queryClient.invalidateQueries({ queryKey: ["my-businesses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Loyalty"
        description="Your stamp cards, reward rules and how stamps get issued."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 size-4" /> New program
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New loyalty program</DialogTitle>
                <DialogDescription>Example: collect 10 stamps and get a FREE Coffee.</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  createProgram.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label>Program name</Label>
                  <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Stamps required</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.stamps_required}
                      onChange={(e) => setForm({ ...form, stamps_required: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reward type</Label>
                    <Select value={form.reward_type} onValueChange={(v) => setForm({ ...form, reward_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FREE_PRODUCT">Free product</SelectItem>
                        <SelectItem value="DISCOUNT">Discount</SelectItem>
                        <SelectItem value="CUSTOM">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Reward description</Label>
                  <Input
                    required
                    value={form.reward_description}
                    onChange={(e) => setForm({ ...form, reward_description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reward expiry (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.reward_expiry_days}
                    onChange={(e) => setForm({ ...form, reward_expiry_days: Number(e.target.value) })}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createProgram.isPending}>
                    {createProgram.isPending ? "Creating…" : "Create program"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active loyalty cards" value={stats.data?.cards ?? 0} icon={Stamp} />
        <StatCard label="Stamps issued" value={stats.data?.stamps ?? 0} />
        <StatCard label="Rewards waiting" value={stats.data?.available ?? 0} />
        <StatCard label="Rewards redeemed" value={stats.data?.redeemed ?? 0} />
      </div>

      <div className="surface mt-6 p-5">
        <h3 className="text-sm font-semibold">How stamps are given</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Staff approval is safest: a team member confirms the visit. Self scan lets customers stamp
          themselves after scanning your QR code.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Select value={business!.stamp_mode} onValueChange={(v) => stampMode.mutate(v)}>
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STAFF_APPROVAL">Staff approval</SelectItem>
              <SelectItem value="SELF_SCAN">Customer self scan</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Cooldown {business!.stamp_cooldown_minutes} min · max {business!.daily_stamp_limit}/day
          </span>
        </div>
      </div>

      <div className="mt-6">
        {programs.isLoading ? (
          <Skeleton className="h-48 rounded-2xl" />
        ) : (programs.data ?? []).length === 0 ? (
          <EmptyState
            icon={Stamp}
            title="No loyalty program yet"
            description="Create a stamp card so customers can start earning rewards on every visit."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {programs.data!.map((p) => (
              <div key={p.id} className="surface p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.stamps_required} stamps → {p.reward_description} · expires in{" "}
                      {p.reward_expiry_days} days
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Active" : "Paused"}
                    </Badge>
                    <Switch
                      checked={p.is_active}
                      onCheckedChange={(v) => toggleProgram.mutate({ id: p.id, isActive: v })}
                    />
                  </div>
                </div>
                <div className="mt-5">
                  <StampGrid stamps={Math.min(6, p.stamps_required)} required={p.stamps_required} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
