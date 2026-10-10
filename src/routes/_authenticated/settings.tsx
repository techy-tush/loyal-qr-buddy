import { SocialLinksEditor } from "@/components/app/SocialLinksEditor";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusiness } from "@/hooks/use-business";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Business settings | Digital Udyam" },
    { name: "description", content: "Manage your business profile and customer contact links." },
    { property: "og:title", content: "Business settings | Digital Udyam" },
    { property: "og:description", content: "Keep your Digital Udyam business profile up to date." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <AppShell><SettingsPage /></AppShell>,
});

type FormState = { name: string; phone: string; email: string; website: string; address: string; city: string; state: string; pincode: string; google_review_url: string; instagram_url: string; whatsapp_number: string; facebook_url: string; google_maps_url: string };
const emptyForm: FormState = { name: "", phone: "", email: "", website: "", address: "", city: "", state: "", pincode: "", google_review_url: "", instagram_url: "", whatsapp_number: "", facebook_url: "", google_maps_url: "" };

function SettingsPage() {
  const { business, role, refetch } = useBusiness();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const canEdit = role === "BUSINESS_OWNER" || role === "BUSINESS_MANAGER" || role === "SUPER_ADMIN";
  useEffect(() => {
    if (!business) return;
    setForm({ name: business.name, phone: business.phone ?? "", email: business.email ?? "", website: business.website ?? "", address: business.address ?? "", city: business.city ?? "", state: business.state ?? "", pincode: business.pincode ?? "", google_review_url: business.google_review_url ?? "", instagram_url: business.instagram_url ?? "", whatsapp_number: business.whatsapp_number ?? "", facebook_url: business.facebook_url ?? "", google_maps_url: business.google_maps_url ?? "" });
  }, [business]);
  const save = useMutation({
    mutationFn: async () => {
      if (!business || !canEdit) throw new Error("You do not have permission to update this business.");
      const { error } = await supabase.from("businesses").update(form).eq("id", business.id);
      if (error) throw error;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["my-businesses"] }); refetch(); toast.success("Business settings saved."); },
    onError: (error) => toast.error(error.message),
  });
  const field = (key: keyof FormState, label: string, placeholder?: string) => (
    <div className="space-y-2"><Label htmlFor={key}>{label}</Label><Input id={key} value={form[key]} placeholder={placeholder} disabled={!canEdit || save.isPending} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} /></div>
  );
  return <>
    <PageHeader title="Settings" description="Business details and the links customers see after every visit." action={<Button onClick={() => save.mutate()} disabled={!canEdit || save.isPending || !form.name.trim()}><Save className="size-4" />{save.isPending ? "Saving…" : "Save"}</Button>} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="surface p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-md bg-accent text-primary"><Building2 className="size-5" /></span><div><h2 className="font-semibold">Business profile</h2><p className="text-sm text-muted-foreground">Used across QR pages and customer cards.</p></div></div><div className="grid gap-4 md:grid-cols-2">{field("name", "Business name")}{field("phone", "Business phone")}{field("email", "Business email")}{field("website", "Website", "https://")}<div className="md:col-span-2">{field("address", "Address")}</div>{field("city", "City")}{field("state", "State")}{field("pincode", "Pincode")}</div></section>
      <section className="surface p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-md bg-accent text-primary"><ShieldCheck className="size-5" /></span><div><h2 className="font-semibold">Customer links</h2><p className="text-sm text-muted-foreground">Shown only when you provide them.</p></div></div><div className="space-y-4">{field("google_review_url", "Google review URL", "https://")}{field("instagram_url", "Instagram URL", "https://")}{field("google_maps_url", "Google Maps location link", "https://maps.app.goo.gl/…")}{field("whatsapp_number", "WhatsApp number")}</div></section>
      {business?.id ? <SocialLinksEditor businessId={business?.id ?? ""} /> : null}
    </div>
  </>;
}