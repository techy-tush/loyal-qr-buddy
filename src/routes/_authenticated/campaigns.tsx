import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Cake, Heart, Megaphone, Plus, RefreshCw, Timer, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";
import { getChannelStatus, runAutomationNow } from "@/lib/automation.functions";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns & automation | Digital Udyam" },
      {
        name: "description",
        content:
          "Automatic birthday, anniversary, win-back and expiring-reward messages over email, SMS and WhatsApp.",
      },
      { property: "og:title", content: "Campaigns & automation | Digital Udyam" },
      {
        property: "og:description",
        content: "Bring customers back automatically with scheduled loyalty messages.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <CampaignsPage />
    </AppShell>
  ),
});

const TYPES = [
  {
    value: "BIRTHDAY",
    label: "Birthday wish",
    icon: Cake,
    hint: "Sent on the customer's birthday.",
  },
  {
    value: "ANNIVERSARY",
    label: "Anniversary wish",
    icon: Heart,
    hint: "Sent on the customer's anniversary.",
  },
  {
    value: "WIN_BACK",
    label: "Win back",
    icon: RefreshCw,
    hint: "Sent when a customer has not visited for 30 days.",
  },
  {
    value: "REWARD_EXPIRING",
    label: "Reward expiring",
    icon: Timer,
    hint: "Sent when a reward expires within 3 days.",
  },
] as const;

const CHANNELS = [
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "WhatsApp" },
] as const;

const AUDIENCES = [
  { value: "ALL", label: "All customers" },
  { value: "NEW", label: "New customers" },
  { value: "REPEAT", label: "Repeat customers" },
  { value: "INACTIVE", label: "Inactive customers" },
  { value: "VIP", label: "VIP customers" },
] as const;

const DEFAULT_MESSAGES: Record<string, string> = {
  BIRTHDAY: "Happy birthday {{name}}! Visit {{business}} today and enjoy a treat on us.",
  ANNIVERSARY: "Happy anniversary {{name}}! Celebrate with us at {{business}}.",
  WIN_BACK: "We miss you {{name}}. Come back to {{business}} and enjoy 10% OFF your next visit.",
  REWARD_EXPIRING:
    "{{name}}, your reward at {{business}} expires soon. Use code {{code}} before it runs out.",
};

const emptyForm = {
  name: "",
  type: "BIRTHDAY" as (typeof TYPES)[number]["value"],
  channel: "EMAIL" as (typeof CHANNELS)[number]["value"],
  audience: "ALL" as (typeof AUDIENCES)[number]["value"],
  message: DEFAULT_MESSAGES["BIRTHDAY"]!,
};

function typeMeta(type: string) {
  return TYPES.find((t) => t.value === type);
}

function CampaignsPage() {
  const { business } = useBusiness();
  const businessId = business?.id ?? null;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const runNow = useServerFn(runAutomationNow);
  const channelStatusFn = useServerFn(getChannelStatus);

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const logsQuery = useQuery({
    queryKey: ["notification-logs", businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("*, customers(full_name, phone), campaigns(name)")
        .eq("business_id", businessId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const channels = useQuery({
    queryKey: ["channel-status"],
    queryFn: () => channelStatusFn({}),
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Give this campaign a name.");
      const { error } = await supabase.from("campaigns").insert({
        business_id: businessId!,
        name: form.name.trim(),
        type: form.type,
        channel: form.channel,
        audience: form.audience,
        message: form.message.trim() || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign created and switched on.");
      setOpen(false);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["campaigns", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCampaign = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("campaigns").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["campaigns", businessId] }),
    onError: () => toast.error("Could not update this campaign."),
  });

  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campaign removed.");
      void queryClient.invalidateQueries({ queryKey: ["campaigns", businessId] });
    },
    onError: () =>
      toast.error("This campaign has messages recorded. Switch it off instead of deleting."),
  });

  const runMutation = useMutation({
    mutationFn: () => runNow({ data: { businessId: businessId! } }),
    onSuccess: (s) => {
      if (s.campaigns === 0) toast.message("No active campaigns to run right now.");
      else if (s.sent === 0 && s.queued === 0 && s.skipped === 0)
        toast.message("No customers matched your campaigns today.");
      else
        toast.success(
          `${s.sent} sent, ${s.queued} waiting for a provider, ${s.skipped} without contact details.`,
        );
      void queryClient.invalidateQueries({ queryKey: ["notification-logs", businessId] });
      void queryClient.invalidateQueries({ queryKey: ["campaigns", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campaigns = campaignsQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  const activeCount = campaigns.filter((c) => c.is_active).length;
  const sentCount = logs.filter((l) => l.status === "SENT").length;
  const missingChannels = channels.data
    ? CHANNELS.filter((c) => !channels.data[c.value]).map((c) => c.label)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns & automation"
        description="Birthday, anniversary, win-back and expiring-reward messages, sent automatically every day."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending || !businessId}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {runMutation.isPending ? "Running…" : "Run now"}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>New automated campaign</DialogTitle>
                  <DialogDescription>
                    Pick what triggers the message, who receives it and how it is delivered.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="campaign-name">Campaign name</Label>
                    <Input
                      id="campaign-name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Birthday treat"
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>When to send</Label>
                      <Select
                        value={form.type}
                        onValueChange={(v) =>
                          setForm({
                            ...form,
                            type: v as typeof form.type,
                            message: DEFAULT_MESSAGES[v] ?? "",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Channel</Label>
                      <Select
                        value={form.channel}
                        onValueChange={(v) => setForm({ ...form, channel: v as typeof form.channel })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHANNELS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Who receives it</Label>
                    <Select
                      value={form.audience}
                      onValueChange={(v) => setForm({ ...form, audience: v as typeof form.audience })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIENCES.map((a) => (
                          <SelectItem key={a.value} value={a.value}>
                            {a.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="campaign-message">Message</Label>
                    <Textarea
                      id="campaign-message"
                      rows={3}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {"{{name}}"} for the customer, {"{{business}}"} for your shop and{" "}
                      {"{{code}}"} for a reward code.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{typeMeta(form.type)?.hint}</p>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createCampaign.mutate()}
                    disabled={createCampaign.isPending}
                  >
                    {createCampaign.isPending ? "Saving…" : "Create campaign"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Campaigns" value={campaigns.length} icon={Megaphone} />
        <StatCard label="Running" value={activeCount} icon={RefreshCw} />
        <StatCard label="Recent messages" value={logs.length} icon={Cake} />
        <StatCard label="Delivered" value={sentCount} icon={Timer} />
      </div>

      {missingChannels.length > 0 ? (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-medium">Delivery not connected for: {missingChannels.join(", ")}</p>
          <p className="text-muted-foreground">
            Messages for those channels are still prepared and recorded below, so nothing is lost.
            They start going out as soon as sending is connected.
          </p>
        </div>
      ) : null}

      {campaignsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Add a birthday wish or a win-back message and we'll send it automatically every day."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => {
            const meta = typeMeta(c.type);
            const Icon = meta?.icon ?? Megaphone;
            return (
              <div key={c.id} className="surface space-y-3 rounded-2xl p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-accent p-2 text-accent-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{meta?.label ?? c.type}</p>
                    </div>
                  </div>
                  <Badge variant={c.is_active ? "default" : "secondary"}>
                    {c.is_active ? "Running" : "Off"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.message ?? meta?.hint}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{c.channel}</Badge>
                  <Badge variant="outline">
                    {AUDIENCES.find((a) => a.value === c.audience)?.label ?? c.audience}
                  </Badge>
                  {c.last_run_at ? (
                    <span>Last run {new Date(c.last_run_at).toLocaleDateString()}</span>
                  ) : (
                    <span>Not run yet</span>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={c.is_active}
                      onCheckedChange={(v) => toggleCampaign.mutate({ id: c.id, is_active: v })}
                    />
                    Sending
                  </label>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Remove campaign">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this campaign?</AlertDialogTitle>
                        <AlertDialogDescription>
                          It will stop sending immediately. Messages already recorded stay in your
                          history.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCampaign.mutate(c.id)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="surface rounded-2xl p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold">Recent messages</h2>
        {logsQuery.isLoading ? (
          <Skeleton className="mt-4 h-24 rounded-xl" />
        ) : logs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing sent yet. Messages appear here once a campaign runs.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {logs.map((l) => {
              const customer = l.customers as { full_name?: string; phone?: string } | null;
              const campaign = l.campaigns as { name?: string } | null;
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                  <span className="font-medium">{customer?.full_name ?? "Customer"}</span>
                  <span className="text-muted-foreground">{campaign?.name ?? l.event}</span>
                  <Badge variant="outline">{l.channel}</Badge>
                  <Badge variant={l.status === "SENT" ? "default" : "secondary"}>
                    {l.status === "SENT"
                      ? "Delivered"
                      : l.status === "QUEUED_NO_PROVIDER"
                        ? "Waiting to send"
                        : l.status === "SKIPPED_NO_ADDRESS"
                          ? "No contact details"
                          : "Failed"}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
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
