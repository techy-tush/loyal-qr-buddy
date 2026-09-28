import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Plus, Sparkles, Trash2 } from "lucide-react";
import { announceOffer } from "@/lib/push.functions";
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
import { Textarea } from "@/components/ui/textarea";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/offers")({
  head: () => ({
    meta: [
      { title: "Offers | Digital Udyam" },
      {
        name: "description",
        content:
          "Give a free product or a discount — manage every offer from one place.",
      },
      { property: "og:title", content: "Offers | Digital Udyam" },
      {
        property: "og:description",
        content: "Target new, repeat, inactive or VIP customers with time-limited offers.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <OffersPage />
    </AppShell>
  ),
});

const OFFER_TYPES = [
  { value: "PERCENT", label: "Percentage discount", needsValue: true, unit: "%" },
  { value: "FLAT", label: "Flat discount", needsValue: true, unit: "₹" },
  { value: "FREE_PRODUCT", label: "Free product", needsValue: false, unit: "" },
] as const;

const AUDIENCES = [
  { value: "ALL", label: "All customers" },
  { value: "NEW", label: "New customers" },
  { value: "REPEAT", label: "Repeat customers" },
  { value: "INACTIVE", label: "Inactive customers" },
  { value: "VIP", label: "VIP customers" },
] as const;

const emptyForm = {
  title: "",
  description: "",
  image_url: "",
  offer_type: "PERCENT" as (typeof OFFER_TYPES)[number]["value"],
  discount_value: "10",
  starts_at: "",
  ends_at: "",
  usage_limit: "",
  branch_id: "all",
  audience: "ALL" as (typeof AUDIENCES)[number]["value"],
};

function offerBadge(type: string, value: number | null) {
  if (type === "PERCENT") return `${value ?? 0}% off`;
  if (type === "FLAT") return `₹${value ?? 0} off`;
  if (type === "BOGO") return "Buy 1 get 1";
  if (type === "FREE_PRODUCT") return "Free product";
  return "Custom";
}

function OffersPage() {
  const { business, branches, role } = useBusiness();
  const businessId = business!.id;
  const queryClient = useQueryClient();
  const announceFn = useServerFn(announceOffer);

  const isAdmin = role === "BUSINESS_OWNER" || role === "BUSINESS_MANAGER" || role === "SUPER_ADMIN";

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const offers = useQuery({
    queryKey: ["offers", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const redemptions = useQuery({
    queryKey: ["offer-redemptions", businessId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("offer_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const title = form.title.trim();
      if (title.length < 2) throw new Error("Give the offer a title.");
      const typeMeta = OFFER_TYPES.find((t) => t.value === form.offer_type)!;
      const value = typeMeta.needsValue ? Number(form.discount_value) : null;
      if (typeMeta.needsValue && (!value || value <= 0))
        throw new Error("Enter a discount greater than zero.");
      if (form.starts_at && form.ends_at && form.ends_at < form.starts_at)
        throw new Error("The end date must be after the start date.");

      const { error } = await supabase.from("offers").insert({
        business_id: businessId,
        branch_id: form.branch_id === "all" ? null : form.branch_id,
        title,
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        offer_type: form.offer_type,
        discount_value: value,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        audience: form.audience,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offer created");
      setOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["offers", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("offers").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offers", businessId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offer deleted");
      queryClient.invalidateQueries({ queryKey: ["offers", businessId] });
    },
    onError: () =>
      toast.error("This offer has been used by customers. Switch it off instead of deleting it."),
  });

  const announce = useMutation({
    mutationFn: (offerId: string) => announceFn({ data: { businessId: businessId!, offerId } }),
    onSuccess: (res) => {
      if (res.skipped) {
        toast.info("Phone alerts aren't connected yet, so nothing was sent.");
      } else if (res.sent === 0) {
        toast.info("No customers have switched on alerts yet.");
      } else {
        toast.success(`Alert sent to ${res.sent} customer${res.sent === 1 ? "" : "s"}.`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const list = offers.data ?? [];
  const typeMeta = OFFER_TYPES.find((t) => t.value === form.offer_type)!;

  const createDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!isAdmin}>
          <Plus className="mr-1.5 size-4" /> New offer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New offer</DialogTitle>
          <DialogDescription>
            Active offers show on the QR landing page and inside every customer’s loyalty card.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="o-title">Title</Label>
            <Input
              id="o-title"
              maxLength={120}
              placeholder="Weekend 20% off"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-desc">Description</Label>
            <Textarea
              id="o-desc"
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Offer type</Label>
              <Select
                value={form.offer_type}
                onValueChange={(v) =>
                  setForm({ ...form, offer_type: v as typeof form.offer_type })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFER_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {typeMeta.needsValue ? (
              <div className="grid gap-1.5">
                <Label htmlFor="o-value">Discount ({typeMeta.unit})</Label>
                <Input
                  id="o-value"
                  type="number"
                  min={1}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                />
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="o-start">Starts</Label>
              <Input
                id="o-start"
                type="date"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="o-end">Ends</Label>
              <Input
                id="o-end"
                type="date"
                value={form.ends_at}
                onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="o-limit">Usage limit</Label>
              <Input
                id="o-limit"
                type="number"
                min={1}
                placeholder="Unlimited"
                value={form.usage_limit}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Audience</Label>
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
          </div>
          <div className="grid gap-1.5">
            <Label>Branch</Label>
            <Select
              value={form.branch_id}
              onValueChange={(v) => setForm({ ...form, branch_id: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="o-image">Image URL (optional)</Label>
            <Input
              id="o-image"
              maxLength={500}
              placeholder="https://…"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div>
      <PageHeader
        title="Offers"
        description="Run discounts and freebies for the exact customers you want back."
        action={createDialog}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Offers" value={list.length} icon={Sparkles} />
        <StatCard label="Live now" value={list.filter((o) => o.is_active).length} />
        <StatCard label="Offer redemptions" value={redemptions.data ?? 0} />
      </div>

      {offers.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No offers yet"
          description="Create your first offer — it appears instantly for customers who scan your QR code."
          action={createDialog}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((offer) => (
            <div key={offer.id} className="surface flex flex-col p-5">
              {offer.image_url ? (
                <img
                  src={offer.image_url}
                  alt={offer.title}
                  className="mb-4 h-32 w-full rounded-xl object-cover"
                />
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{offer.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {offerBadge(offer.offer_type, offer.discount_value)} ·{" "}
                    {AUDIENCES.find((a) => a.value === offer.audience)?.label} ·{" "}
                    {branches.find((b) => b.id === offer.branch_id)?.name ?? "All branches"}
                  </p>
                </div>
                <Badge variant={offer.is_active ? "default" : "secondary"}>
                  {offer.is_active ? "Live" : "Off"}
                </Badge>
              </div>

              {offer.description ? (
                <p className="mt-3 text-sm text-muted-foreground">{offer.description}</p>
              ) : null}

              <p className="mt-3 text-xs text-muted-foreground">
                {offer.starts_at || offer.ends_at
                  ? `${offer.starts_at ? new Date(offer.starts_at).toLocaleDateString() : "Now"} – ${
                      offer.ends_at ? new Date(offer.ends_at).toLocaleDateString() : "No end date"
                    }`
                  : "No date limit"}
                {offer.usage_limit ? ` · limit ${offer.usage_limit}` : ""}
              </p>

              <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={offer.is_active}
                    disabled={!isAdmin}
                    onCheckedChange={(v) => toggle.mutate({ id: offer.id, is_active: v })}
                  />
                  Live for customers
                </label>
                {isAdmin && offer.is_active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={announce.isPending}
                    onClick={() => announce.mutate(offer.id)}
                  >
                    <Bell className="mr-1.5 size-4" /> Alert customers
                  </Button>
                ) : null}
                {isAdmin ? (

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this offer?</AlertDialogTitle>
                        <AlertDialogDescription>
                          “{offer.title}” will disappear from every customer’s card.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove.mutate(offer.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
