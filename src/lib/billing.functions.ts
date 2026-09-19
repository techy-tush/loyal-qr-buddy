import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const cycleSchema = z.enum(["MONTHLY", "YEARLY"]);

/** Is online payment configured for this deployment? */
export const getPaymentStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getRazorpayConfig } = await import("@/lib/billing.server");
  const config = getRazorpayConfig();
  return { provider: "razorpay" as const, enabled: Boolean(config) };
});

/** Start a plan upgrade: creates a provider order and a pending payment row. */
export const createUpgradeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        planId: z.string().uuid(),
        cycle: cycleSchema.default("MONTHLY"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_business_admin", {
      _business_id: data.businessId,
    });
    if (!isAdmin) throw new Error("Only the business owner can change the plan.");

    const { data: plan } = await context.supabase
      .from("plans")
      .select("id, code, name, price_monthly, price_yearly, is_active")
      .eq("id", data.planId)
      .maybeSingle();
    if (!plan || !plan.is_active) throw new Error("That plan is not available.");
    if (plan.code === "ENTERPRISE")
      throw new Error("Enterprise is billed manually — please contact our team.");

    const amount = Number(data.cycle === "YEARLY" ? plan.price_yearly : plan.price_monthly);
    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error("This plan has no online price. Please contact our team.");

    const { getRazorpayConfig, createRazorpayOrder } = await import("@/lib/billing.server");
    const config = getRazorpayConfig();
    if (!config)
      throw new Error(
        "Online payments are not connected yet. Ask the platform team to add the Razorpay keys.",
      );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("business_id", data.businessId)
      .maybeSingle();

    const receipt = `du_${data.businessId.slice(0, 8)}_${Date.now()}`;
    const order = await createRazorpayOrder({
      config,
      amountPaise: Math.round(amount * 100),
      currency: "INR",
      receipt,
      notes: { business_id: data.businessId, plan_id: plan.id, cycle: data.cycle },
    });

    const { error } = await supabaseAdmin.from("payments").insert({
      business_id: data.businessId,
      subscription_id: sub?.id ?? null,
      amount,
      currency: "INR",
      provider: "razorpay",
      provider_ref: order.id,
      status: "PENDING",
    });
    if (error) throw new Error(error.message);

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: config.keyId,
      planName: plan.name,
      cycle: data.cycle,
    };
  });

/** Verify the provider signature and activate the paid plan. */
export const confirmUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        planId: z.string().uuid(),
        cycle: cycleSchema,
        orderId: z.string().min(6).max(64),
        paymentId: z.string().min(6).max(64),
        signature: z.string().min(16).max(256),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_business_admin", {
      _business_id: data.businessId,
    });
    if (!isAdmin) throw new Error("Only the business owner can change the plan.");

    const { getRazorpayConfig, hmacSha256Hex, safeEqualHex, invoiceNumber, periodEnd } =
      await import("@/lib/billing.server");
    const config = getRazorpayConfig();
    if (!config) throw new Error("Online payments are not connected yet.");

    const expected = hmacSha256Hex(config.keySecret, `${data.orderId}|${data.paymentId}`);
    if (!safeEqualHex(expected, data.signature))
      throw new Error("We could not verify this payment. Nothing has been charged twice.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, business_id, status, amount, subscription_id")
      .eq("provider_ref", data.orderId)
      .maybeSingle();
    if (!payment || payment.business_id !== data.businessId)
      throw new Error("This payment does not belong to your business.");
    if (payment.status === "SUCCESS")
      return { alreadyProcessed: true as const, invoiceNumber: null as string | null };

    const invoice = invoiceNumber();
    await supabaseAdmin
      .from("payments")
      .update({ status: "SUCCESS", invoice_number: invoice })
      .eq("id", payment.id)
      .eq("status", "PENDING");

    const currentPeriodEnd = periodEnd(data.cycle);
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("business_id", data.businessId)
      .maybeSingle();

    if (sub) {
      await supabaseAdmin
        .from("subscriptions")
        .update({
          plan_id: data.planId,
          status: "ACTIVE",
          provider: "razorpay",
          current_period_end: currentPeriodEnd,
        })
        .eq("id", sub.id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        business_id: data.businessId,
        plan_id: data.planId,
        status: "ACTIVE",
        provider: "razorpay",
        current_period_end: currentPeriodEnd,
      });
    }

    await supabaseAdmin.from("audit_logs").insert({
      business_id: data.businessId,
      actor_id: context.userId,
      action: "SUBSCRIPTION_UPGRADED",
      entity: "subscriptions",
      entity_id: sub?.id ?? null,
      meta: { plan_id: data.planId, cycle: data.cycle, invoice_number: invoice },
    });

    return { alreadyProcessed: false as const, invoiceNumber: invoice };
  });

/** Cancel at period end. Access stays until current_period_end. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_business_admin", {
      _business_id: data.businessId,
    });
    if (!isAdmin) throw new Error("Only the business owner can cancel the plan.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status")
      .eq("business_id", data.businessId)
      .maybeSingle();
    if (!sub) throw new Error("No subscription found for this business.");
    if (sub.status === "CANCELLED") return { ok: true as const };

    await supabaseAdmin.from("subscriptions").update({ status: "CANCELLED" }).eq("id", sub.id);
    await supabaseAdmin.from("audit_logs").insert({
      business_id: data.businessId,
      actor_id: context.userId,
      action: "SUBSCRIPTION_CANCELLED",
      entity: "subscriptions",
      entity_id: sub.id,
      meta: {},
    });
    return { ok: true as const };
  });
