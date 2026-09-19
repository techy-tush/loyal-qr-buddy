import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Customer-side: remember this phone so we can alert it about rewards and offers. */
export const registerPushDevice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        customerToken: z.string().min(10).max(128),
        token: z.string().min(20).max(4096),
        platform: z.enum(["WEB", "ANDROID", "IOS"]).default("WEB"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id, business_id")
      .eq("access_token", data.customerToken)
      .maybeSingle();
    if (!customer) throw new Error("This loyalty card link is no longer valid.");

    const { error } = await supabaseAdmin.from("customer_push_tokens").upsert(
      {
        business_id: customer.business_id,
        customer_id: customer.id,
        token: data.token,
        platform: data.platform,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Customer-side: stop alerts for this phone. */
export const unregisterPushDevice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(20).max(4096) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("customer_push_tokens")
      .update({ is_active: false })
      .eq("token", data.token);
    return { ok: true };
  });

/** Business-side: announce an offer to every customer who opted in. */
export const announceOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ businessId: z.string().uuid(), offerId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("is_business_admin", {
      _business_id: data.businessId,
    });
    if (allowed !== true) throw new Error("You don't have access to this business.");

    const { data: offer } = await context.supabase
      .from("offers")
      .select("id, title, description, business_id")
      .eq("id", data.offerId)
      .eq("business_id", data.businessId)
      .maybeSingle();
    if (!offer) throw new Error("Offer not found.");

    const { data: business } = await context.supabase
      .from("businesses")
      .select("name")
      .eq("id", data.businessId)
      .maybeSingle();

    const { sendCustomerPush } = await import("@/lib/push.server");
    return sendCustomerPush({
      businessId: data.businessId,
      title: `New offer at ${business?.name ?? "your favourite spot"}`,
      body: offer.description ? `${offer.title} — ${offer.description}` : offer.title,
    });
  });

/** Is push delivery wired up yet? */
export const getPushStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { pushConfigured } = await import("@/lib/push.server");
  return { configured: pushConfigured() };
});
