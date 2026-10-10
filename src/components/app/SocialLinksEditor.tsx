import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_KEYS, safeHttpsUrl, type SocialLinks } from "@/lib/validation";

export function SocialLinksEditor({ businessId }: { businessId: string }) {
  const [links, setLinks] = useState<SocialLinks>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from("businesses").select("social_links, instagram_url, facebook_url, google_maps_url, google_review_url, whatsapp_number").eq("id", businessId).maybeSingle().then(({ data }) => {
      const cur = ((data?.social_links ?? {}) as SocialLinks) || {};
      const seed = (k: keyof SocialLinks, url?: string | null) => { if (!cur[k] && url) cur[k] = { url, enabled: true }; };
      seed("instagram", data?.instagram_url); seed("facebook", data?.facebook_url);
      seed("google_maps", data?.google_maps_url); seed("google_reviews", data?.google_review_url);
      if (data?.whatsapp_number) seed("whatsapp", `https://wa.me/${data.whatsapp_number.replace(/[^0-9]/g, "")}`);
      setLinks({ ...cur });
    });
  }, [businessId]);

  async function save() {
    const clean: SocialLinks = {};
    for (const [k, label] of SOCIAL_KEYS) {
      const v = links[k];
      if (!v?.url?.trim()) continue;
      const url = safeHttpsUrl(v.url);
      if (!url) { toast.error(`${label}: link must start with https://`); return; }
      clean[k] = { url, enabled: v.enabled };
    }
    setBusy(true);
    const { error } = await supabase.from("businesses").update({ social_links: clean as never }).eq("id", businessId);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Links saved.");
  }

  return (
    <section className="surface p-5 md:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-accent text-primary"><Share2 className="size-5" /></span>
        <div><h2 className="font-semibold">Social Media &amp; Business Links</h2><p className="text-sm text-muted-foreground">Only switched-on links with a valid https:// address are shown to customers.</p></div>
      </div>
      <div className="space-y-3">
        {SOCIAL_KEYS.map(([k, label]) => (
          <div key={k} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 sm:grid-cols-[160px_1fr_auto]">
            <span className="text-sm font-medium">{label}</span>
            <Input placeholder="https://" value={links[k]?.url ?? ""} onChange={(e) => setLinks({ ...links, [k]: { url: e.target.value, enabled: links[k]?.enabled ?? true } })} />
            <Switch aria-label={`Show ${label}`} checked={links[k]?.enabled ?? false} onCheckedChange={(v) => setLinks({ ...links, [k]: { url: links[k]?.url ?? "", enabled: v } })} />
          </div>
        ))}
      </div>
      <Button className="mt-4" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save links"}</Button>
    </section>
  );
}
