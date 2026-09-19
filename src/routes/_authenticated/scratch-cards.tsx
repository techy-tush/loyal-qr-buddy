import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Gift, Plus, Sparkles, Trash2, Trophy } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/scratch-cards")({
  head: () => ({
    meta: [
      { title: "Scratch cards | Digital Udyam" },
      {
        name: "description",
        content:
          "Run scratch-and-win campaigns with real odds decided on the server and one play per customer.",
      },
      { property: "og:title", content: "Scratch cards | Digital Udyam" },
      {
        property: "og:description",
        content: "Set prizes and win chances; every result is decided securely and can be claimed once.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ScratchPage />
    </AppShell>
  ),
});

const TRIGGERS = [
  { value: "SCAN", label: "Every QR scan" },
  { value: "STAMP", label: "After a stamp" },
  { value: "JOIN", label: "On joining the programme" },
] as const;

type Campaign = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  trigger: string;
  is_active: boolean;
};

type Prize = {
  id: string;
  campaign_id: string;
  label: string;
  probability: number;
  reward_description: string | null;
  is_win: boolean;
  expiry_days: number;
};

function ScratchPage() {
  const { business, role } = useBusiness();
  const businessId = business!.id;
  const queryClient = useQueryClient();
  const isAdmin = role === "BUSINESS_OWNER" || role === "BUSINESS_MANAGER" || role === "SUPER_ADMIN";

  const [openCampaign, setOpenCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    starts_at: "",
    ends_at: "",
    trigger: "SCAN" as string,
  });
  const [prizeFor, setPrizeFor] = useState<string | null>(null);
  const [prizeForm, setPrizeForm] = useState({
    label: "",
    probability: "10",
    reward_description: "",
    is_win: true,
    expiry_days: "14",
  });

  const campaigns = useQuery({
    queryKey: ["scratch-campaigns", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scratch_campaigns")
        .select("id, name, starts_at, ends_at, trigger, is_active")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const prizes = useQuery({
    queryKey: ["scratch-prizes", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scratch_prizes")
        .select("id, campaign_id, label, probability, reward_description, is_win, expiry_days")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Prize[];
    },
  });

  const wins = useQuery({
    queryKey: ["scratch-wins", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scratch_wins")
        .select(
          "id, created_at, campaign_id, customers(full_name, phone), scratch_prizes(label, is_win)",
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data;
    },
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      const name = campaignForm.name.trim();
      if (name.length < 2) throw new Error("Give the campaign a name.");
      if (campaignForm.starts_at && campaignForm.ends_at && campaignForm.ends_at < campaignForm.starts_at)
        throw new Error("The end date must be after the start date.");
      const { error } = await supabase.from("scratch_campaigns").insert({
        business_id: businessId,
        name,
        starts_at: campaignForm.starts_at || null,
        ends_at: campaignForm.ends_at || null,
        trigger: campaignForm.trigger,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign created — add prizes next");
      setOpenCampaign(false);
      setCampaignForm({ name: "", starts_at: "", ends_at: "", trigger: "SCAN" });
      queryClient.invalidateQueries({ queryKey: ["scratch-campaigns", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPrize = useMutation({
    mutationFn: async (campaignId: string) => {
      const label = prizeForm.label.trim();
      if (label.length < 1) throw new Error("Give the prize a label.");
      const probability = Number(prizeForm.probability);
      if (!(probability > 0) || probability > 100)
        throw new Error("Win chance must be between 0 and 100.");
      const { error } = await supabase.from("scratch_prizes").insert({
        business_id: businessId,
        campaign_id: campaignId,
        label,
        probability,
        is_win: prizeForm.is_win,
        reward_description: prizeForm.is_win
          ? prizeForm.reward_description.trim() || label
          : null,
        expiry_days: prizeForm.is_win ? Number(prizeForm.expiry_days) || 14 : 14,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prize added");
      setPrizeFor(null);
      setPrizeForm({
        label: "",
        probability: "10",
        reward_description: "",
        is_win: true,
        expiry_days: "14",
      });
      queryClient.invalidateQueries({ queryKey: ["scratch-prizes", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePrize = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scratch_prizes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prize removed");
      queryClient.invalidateQueries({ queryKey: ["scratch-prizes", businessId] });
    },
    onError: () => toast.error("This prize has already been won. Set its chance to a low value instead."),
  });

  const toggleCampaign = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("scratch_campaigns").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scratch-campaigns", businessId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scratch_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign deleted");
      queryClient.invalidateQueries({ queryKey: ["scratch-campaigns", businessId] });
      queryClient.invalidateQueries({ queryKey: ["scratch-prizes", businessId] });
    },
    onError: () => toast.error("This campaign has plays recorded. Switch it off instead of deleting."),
  });

  const list = campaigns.data ?? [];
  const allPrizes = prizes.data ?? [];
  const winRows = wins.data ?? [];

  const newCampaignDialog = (
    <Dialog open={openCampaign} onOpenChange={setOpenCampaign}>
      <DialogTrigger asChild>
        <Button disabled={!isAdmin}>
          <Plus className="mr-1.5 size-4" /> New campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New scratch campaign</DialogTitle>
          <DialogDescription>
            Customers get one play per campaign. The result is decided on our servers, so odds can’t
            be tampered with.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="c-name">Campaign name</Label>
            <Input
              id="c-name"
              maxLength={120}
              placeholder="Festive scratch & win"
              value={campaignForm.name}
              onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="c-start">Starts</Label>
              <Input
                id="c-start"
                type="date"
                value={campaignForm.starts_at}
                onChange={(e) => setCampaignForm({ ...campaignForm, starts_at: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="c-end">Ends</Label>
              <Input
                id="c-end"
                type="date"
                value={campaignForm.ends_at}
                onChange={(e) => setCampaignForm({ ...campaignForm, ends_at: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>When customers can play</Label>
            <Select
              value={campaignForm.trigger}
              onValueChange={(v) => setCampaignForm({ ...campaignForm, trigger: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGERS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending}>
            {createCampaign.isPending ? "Creating…" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div>
      <PageHeader
        title="Scratch cards"
        description="Set your prizes and win chances — we pick the winner securely, once per customer."
        action={newCampaignDialog}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Campaigns" value={list.length} icon={Sparkles} />
        <StatCard label="Running now" value={list.filter((c) => c.is_active).length} />
        <StatCard
          label="Prizes won"
          value={winRows.filter((w) => (w.scratch_prizes as { is_win: boolean } | null)?.is_win).length}
          icon={Trophy}
        />
      </div>

      {campaigns.isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No scratch campaigns yet"
          description="Create a campaign and add prizes like “10% OFF — 20%”, “Free coffee — 5%”, “Try again — 75%”."
          action={newCampaignDialog}
        />
      ) : (
        <div className="grid gap-4">
          {list.map((campaign) => {
            const items = allPrizes.filter((p) => p.campaign_id === campaign.id);
            const total = items.reduce((s, p) => s + Number(p.probability), 0);
            return (
              <div key={campaign.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{campaign.name}</p>
                      <Badge variant={campaign.is_active ? "default" : "secondary"}>
                        {campaign.is_active ? "Running" : "Off"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {TRIGGERS.find((t) => t.value === campaign.trigger)?.label ?? campaign.trigger}{" "}
                      ·{" "}
                      {campaign.starts_at || campaign.ends_at
                        ? `${campaign.starts_at ? new Date(campaign.starts_at).toLocaleDateString() : "Now"} – ${
                            campaign.ends_at
                              ? new Date(campaign.ends_at).toLocaleDateString()
                              : "No end date"
                          }`
                        : "No date limit"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={campaign.is_active}
                        disabled={!isAdmin || items.length === 0}
                        onCheckedChange={(v) =>
                          toggleCampaign.mutate({ id: campaign.id, is_active: v })
                        }
                      />
                      Live
                    </label>
                    {isAdmin ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground">
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
                            <AlertDialogDescription>
                              “{campaign.name}” and its prizes will be removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeCampaign.mutate(campaign.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-4">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No prizes yet — add at least one before switching this campaign on.
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {items.map((prize) => (
                        <div
                          key={prize.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            {prize.is_win ? (
                              <Gift className="size-4 text-primary" />
                            ) : (
                              <span className="size-4 text-center text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                            <span className="font-medium">{prize.label}</span>
                            {prize.is_win ? (
                              <span className="text-xs text-muted-foreground">
                                {prize.reward_description} · expires in {prize.expiry_days} days
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No prize</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {total > 0
                                ? `${Math.round((Number(prize.probability) / total) * 100)}%`
                                : "0%"}
                            </Badge>
                            {isAdmin ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground"
                                onClick={() => removePrize.mutate(prize.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        Chances are shared out of the total you set, so they always add up to 100%.
                      </p>
                    </div>
                  )}

                  {isAdmin ? (
                    <Dialog
                      open={prizeFor === campaign.id}
                      onOpenChange={(v) => setPrizeFor(v ? campaign.id : null)}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="mt-3">
                          <Plus className="mr-1.5 size-4" /> Add prize
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add prize</DialogTitle>
                          <DialogDescription>
                            Include a “Try again” option with a high chance so most plays don’t win.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4">
                          <div className="grid gap-1.5">
                            <Label htmlFor="p-label">Prize label</Label>
                            <Input
                              id="p-label"
                              maxLength={80}
                              placeholder="10% OFF"
                              value={prizeForm.label}
                              onChange={(e) =>
                                setPrizeForm({ ...prizeForm, label: e.target.value })
                              }
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor="p-prob">Chance (relative weight)</Label>
                            <Input
                              id="p-prob"
                              type="number"
                              min={1}
                              max={100}
                              value={prizeForm.probability}
                              onChange={(e) =>
                                setPrizeForm({ ...prizeForm, probability: e.target.value })
                              }
                            />
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <Switch
                              checked={prizeForm.is_win}
                              onCheckedChange={(v) => setPrizeForm({ ...prizeForm, is_win: v })}
                            />
                            This is a winning prize
                          </label>
                          {prizeForm.is_win ? (
                            <>
                              <div className="grid gap-1.5">
                                <Label htmlFor="p-reward">Reward description</Label>
                                <Input
                                  id="p-reward"
                                  maxLength={160}
                                  placeholder="10% off your next bill"
                                  value={prizeForm.reward_description}
                                  onChange={(e) =>
                                    setPrizeForm({
                                      ...prizeForm,
                                      reward_description: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="grid gap-1.5">
                                <Label htmlFor="p-exp">Expires after (days)</Label>
                                <Input
                                  id="p-exp"
                                  type="number"
                                  min={1}
                                  max={365}
                                  value={prizeForm.expiry_days}
                                  onChange={(e) =>
                                    setPrizeForm({ ...prizeForm, expiry_days: e.target.value })
                                  }
                                />
                              </div>
                            </>
                          ) : null}
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => addPrize.mutate(campaign.id)}
                            disabled={addPrize.isPending}
                          >
                            {addPrize.isPending ? "Adding…" : "Add prize"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">Recent plays</h2>
        {wins.isLoading ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : winRows.length === 0 ? (
          <div className="surface p-5 text-sm text-muted-foreground">
            No one has played yet. Plays appear here as soon as customers scratch their card.
          </div>
        ) : (
          <div className="surface divide-y divide-border">
            {winRows.map((win) => {
              const customer = win.customers as { full_name: string; phone: string } | null;
              const prize = win.scratch_prizes as { label: string; is_win: boolean } | null;
              return (
                <div
                  key={win.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                >
                  <span className="font-medium">{customer?.full_name ?? "Customer"}</span>
                  <span className="text-muted-foreground">
                    {list.find((c) => c.id === win.campaign_id)?.name ?? "Campaign"}
                  </span>
                  <Badge variant={prize?.is_win ? "default" : "secondary"}>
                    {prize?.label ?? "Try again"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(win.created_at).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
