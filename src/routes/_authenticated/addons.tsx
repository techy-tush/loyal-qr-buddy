import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, UtensilsCrossed } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UpiPayDialog, type UpiPayment } from "@/components/app/UpiPayDialog";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";
import { startAddonPayment } from "@/lib/billing.functions";

export const Route = createFileRoute("/_authenticated/addons")({
  head: () => ({
    meta: [
      { title: "Add-ons | Digital Udyam" },
      { name: "description", content: "Buy optional add-ons: AI Google Review Writer and Digital Menu." },
      { property: "og:title", content: "Add-ons | Digital Udyam" },
      { property: "og:description", content: "Optional yearly add-ons for your shop." },
    ],
  }),
  component: () => (
    <AppShell>
      <AddonsPage />
    </AppShell>
  ),
});

const ICONS: Record<string, typeof Sparkles> = { REVIEW_WRITER: Sparkles, DIGITAL_MENU: UtensilsCrossed };

function AddonsPage() {
  const { business } = useBusiness();
  const businessId = business!.id;
  const qc = useQueryClient();
  const start = useServerFn(startAddonPayment);
  const [pay, setPay] = useState<UpiPayment | null>(null);

  const addons = useQuery({
    queryKey: ["addons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("addons").select("code, name, description, price_yearly, is_active").eq("is_active", true).order("code");
      if (error) throw error;
      return data;
    },
  });
  const mine = useQuery({
    queryKey: ["business-addons", businessId],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_addons").select("addon_code, status, expires_at").eq("business_id", businessId);
      if (error) throw error;
      return data;
    },
  });
  const pending = useQuery({
    queryKey: ["addon-payments", businessId],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("addon_code").eq("business_id", businessId).eq("status", "PENDING").not("addon_code", "is", null);
      if (error) throw error;
      return data.map((p) => p.addon_code);
    },
  });

  const buy = useMutation({
    mutationFn: (code: "REVIEW_WRITER" | "DIGITAL_MENU") => start({ data: { businessId, addonCode: code } }),
    onSuccess: (res) => {
      setPay(res);
      qc.invalidateQueries({ queryKey: ["addon-payments", businessId] });
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) window.location.href = res.upiUrl;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Add-ons" description="Optional extras, billed yearly. Not included in the main plans." />
      <UpiPayDialog payment={pay} onClose={() => setPay(null)} onSubmitted={() => qc.invalidateQueries({ queryKey: ["addon-payments", businessId] })} />
      {addons.isLoading ? (
        <Skeleton className="h-60 rounded-2xl" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(addons.data ?? []).map((a) => {
            const Icon = ICONS[a.code] ?? Sparkles;
            const row = mine.data?.find((m) => m.addon_code === a.code);
            const active = row && row.status === "ACTIVE" && new Date(row.expires_at) > new Date();
            const expired = row && !active;
            const isPending = pending.data?.includes(a.code);
            return (
              <div key={a.code} className="surface flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary"><Icon className="size-5" /></span>
                  {active ? <Badge>Active</Badge> : expired ? <Badge variant="destructive">Expired</Badge> : isPending ? <Badge variant="secondary">Payment pending</Badge> : <Badge variant="outline">Not active</Badge>}
                </div>
                <h3 className="mt-4 font-bold">{a.name}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{a.description}</p>
                <p className="mt-4 text-2xl font-extrabold">₹{Number(a.price_yearly)}<span className="text-sm font-medium text-muted-foreground">/year</span></p>
                {row ? <p className="mt-1 text-xs text-muted-foreground">{active ? "Valid till" : "Expired on"} {new Date(row.expires_at).toLocaleDateString()}</p> : null}
                <Button className="mt-4" disabled={buy.isPending} onClick={() => buy.mutate(a.code as "REVIEW_WRITER" | "DIGITAL_MENU")}>
                  {active ? "Renew for 1 more year" : expired ? "Renew now" : "Buy add-on"}
                </Button>
                {active && a.code === "DIGITAL_MENU" ? (
                  <Button variant="outline" className="mt-2" asChild><Link to="/menu-builder">Open menu builder</Link></Button>
                ) : null}
                {active && a.code === "REVIEW_WRITER" ? <ReviewSettings businessId={businessId} /> : null}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">After you pay by UPI, the platform team confirms the payment and the add-on switches on for 12 months.</p>
    </>
  );
}

function ReviewSettings({ businessId }: { businessId: string }) {
  const [text, setText] = useState("");
  const q = useQuery({
    queryKey: ["review-settings", businessId],
    queryFn: async () => {
      const { data } = await supabase.from("review_settings").select("highlights").eq("business_id", businessId).maybeSingle();
      return data;
    },
  });
  useEffect(() => setText(q.data?.highlights ?? ""), [q.data]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("review_settings").upsert({ business_id: businessId, highlights: text.slice(0, 500), updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Saved"),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mt-4 space-y-2 border-t border-border pt-4">
      <Label>Shop highlights for AI reviews</Label>
      <Textarea rows={3} placeholder="e.g. cold coffee, cozy seating, fast service" value={text} onChange={(e) => setText(e.target.value)} />
      <p className="text-xs text-muted-foreground">Set your Google review link in Settings.</p>
      <Button size="sm" variant="secondary" onClick={() => save.mutate()} disabled={save.isPending}>Save highlights</Button>
    </div>
  );
}
