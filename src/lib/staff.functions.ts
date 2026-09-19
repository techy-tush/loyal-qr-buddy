import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Issue a stamp as staff. Membership is verified with the caller's own RLS scope. */
export const issueStamp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        customerId: z.string().uuid(),
        branchId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: customer, error } = await context.supabase
      .from("customers")
      .select("id, business_id")
      .eq("id", data.customerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("You don't have access to this customer.");

    const { issueStampCore } = await import("@/lib/stamp.server");
    return issueStampCore({
      customerId: customer.id,
      businessId: customer.business_id,
      branchId: data.branchId ?? null,
      source: "STAFF",
      actorId: context.userId,
    });
  });

/** Redeem a reward by code. Validated fully server-side. */
export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ code: z.string().min(4).max(32), businessId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // RLS-scoped read proves the caller belongs to this business.
    const { data: business } = await context.supabase
      .from("businesses")
      .select("id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (!business) throw new Error("You don't have access to this business.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = data.code.trim().toUpperCase();
    const { data: reward } = await supabaseAdmin
      .from("rewards")
      .select("id, business_id, status, expires_at, description, customer_id")
      .eq("code", code)
      .maybeSingle();

    if (!reward || reward.business_id !== data.businessId)
      throw new Error("Reward code not found for this business.");
    if (reward.status === "REDEEMED") throw new Error("This reward has already been redeemed.");
    if (reward.status === "CANCELLED") throw new Error("This reward was cancelled.");
    if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
      await supabaseAdmin.from("rewards").update({ status: "EXPIRED" }).eq("id", reward.id);
      throw new Error("This reward has expired.");
    }

    const { data: updated, error } = await supabaseAdmin
      .from("rewards")
      .update({
        status: "REDEEMED",
        redeemed_at: new Date().toISOString(),
        redeemed_by: context.userId,
      })
      .eq("id", reward.id)
      .eq("status", "AVAILABLE")
      .select("id, description, customer_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("This reward has already been redeemed.");

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("full_name, phone")
      .eq("id", updated.customer_id)
      .maybeSingle();

    await supabaseAdmin.from("audit_logs").insert({
      business_id: data.businessId,
      actor_id: context.userId,
      action: "REWARD_REDEEMED",
      entity: "reward",
      entity_id: updated.id,
      meta: { code },
    });

    return {
      description: updated.description,
      customerName: customer?.full_name ?? "Customer",
      customerPhone: customer?.phone ?? "",
    };
  });

/** Look up a customer by phone within a business (staff console). */
export const findCustomerByPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ businessId: z.string().uuid(), phone: z.string().min(4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: customer } = await context.supabase
      .from("customers")
      .select("id, full_name, phone, total_visits, last_visit_at")
      .eq("business_id", data.businessId)
      .eq("phone", data.phone.trim())
      .maybeSingle();
    if (!customer) throw new Error("No customer found with that phone number.");

    const { data: card } = await context.supabase
      .from("loyalty_cards")
      .select("stamps, program:loyalty_programs(name, stamps_required, reward_description)")
      .eq("customer_id", customer.id)
      .maybeSingle();

    const { data: rewards } = await context.supabase
      .from("rewards")
      .select("id, code, description, expires_at")
      .eq("customer_id", customer.id)
      .eq("status", "AVAILABLE")
      .order("created_at", { ascending: false });

    return { customer, card, rewards: rewards ?? [] };
  });

/** Manually grant a reward to a customer (owner/manager gesture of goodwill). */
export const grantReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        customerId: z.string().uuid(),
        description: z.string().trim().min(2).max(160),
        expiryDays: z.number().int().min(1).max(365).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // RLS-scoped reads prove the caller can administer this business + customer.
    const { data: admin } = await context.supabase.rpc("is_business_admin", {
      _business_id: data.businessId,
    });
    if (!admin) throw new Error("Only owners and managers can issue rewards.");

    const { data: customer } = await context.supabase
      .from("customers")
      .select("id, business_id")
      .eq("id", data.customerId)
      .maybeSingle();
    if (!customer || customer.business_id !== data.businessId)
      throw new Error("You don't have access to this customer.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reward, error } = await supabaseAdmin
      .from("rewards")
      .insert({
        business_id: data.businessId,
        customer_id: customer.id,
        description: data.description,
        source: "MANUAL",
        expires_at: new Date(Date.now() + data.expiryDays * 86400000).toISOString(),
      })
      .select("id, code, description")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      business_id: data.businessId,
      actor_id: context.userId,
      action: "REWARD_GRANTED",
      entity: "reward",
      entity_id: reward.id,
      meta: { code: reward.code },
    });

    return reward;
  });

/** Cancel an unredeemed reward. */
export const cancelReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ businessId: z.string().uuid(), rewardId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("is_business_admin", {
      _business_id: data.businessId,
    });
    if (!admin) throw new Error("Only owners and managers can cancel rewards.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated } = await supabaseAdmin
      .from("rewards")
      .update({ status: "CANCELLED" })
      .eq("id", data.rewardId)
      .eq("business_id", data.businessId)
      .eq("status", "AVAILABLE")
      .select("id")
      .maybeSingle();
    if (!updated) throw new Error("This reward can no longer be cancelled.");

    await supabaseAdmin.from("audit_logs").insert({
      business_id: data.businessId,
      actor_id: context.userId,
      action: "REWARD_CANCELLED",
      entity: "reward",
      entity_id: data.rewardId,
      meta: {},
    });
    return { ok: true };
  });
