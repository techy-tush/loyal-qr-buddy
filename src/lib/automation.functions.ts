import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });

async function assertBusinessAdmin(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  businessId: string,
) {
  const { data } = await supabase.rpc("is_business_admin", { _business_id: businessId });
  if (data !== true) throw new Error("You do not have permission to manage automation.");
}

/** Which notification channels have a provider configured (no secret values exposed). */
export const getChannelStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { channelConfigured } = await import("@/lib/notify.server");
    return {
      EMAIL: channelConfigured("EMAIL"),
      SMS: channelConfigured("SMS"),
      WHATSAPP: channelConfigured("WHATSAPP"),
    };
  });

/** Run this business's active automations immediately. */
export const runAutomationNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { businessId: string }) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertBusinessAdmin(context.supabase as never, data.businessId);
    const { runAutomation } = await import("@/lib/automation.server");
    return runAutomation(data.businessId);
  });
