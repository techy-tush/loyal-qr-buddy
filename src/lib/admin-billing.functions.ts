import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { indianPhone } from "@/lib/validation";

async function assertSuperAdmin(supabase: SupabaseClient) {
  const { data } = await supabase.rpc("is_super_admin");
  if (!data) throw new Error("This area is for platform administrators only.");
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "shop";

/** Admin creates a business owner + business + subscription + QR, and emails a password-setup invite. */
export const createBusinessUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      fullName: z.string().trim().min(2).max(80),
      businessName: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email().max(120),
      mobile: indianPhone,
      category: z.string().trim().max(40).default(""),
      address: z.string().trim().max(200).default(""),
      city: z.string().trim().max(60).default(""),
      planId: z.string().uuid(),
      paymentMethod: z.enum(["UPI", "MANUAL"]),
      paymentStatus: z.enum(["PENDING", "PAID"]),
      amount: z.number().min(0).max(10_000_000),
      paymentMode: z.string().trim().max(40).default(""),
      reference: z.string().trim().max(60).default(""),
      activationDate: z.string().trim().default(""),
      expiryDate: z.string().trim().default(""),
      notes: z.string().trim().max(500).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    if (data.paymentStatus === "PAID" && data.paymentMethod !== "MANUAL")
      throw new Error("Only manual payments can be marked paid here. UPI payments must be verified from the Payments tab.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const { data: dupe } = await db.from("profiles").select("id").eq("email", data.email).maybeSingle();
    if (dupe) throw new Error("A user with this email already exists.");
    const { data: plan } = await db.from("plans").select("id, duration_months").eq("id", data.planId).maybeSingle();
    if (!plan) throw new Error("Plan not found.");

    const origin = process.env["PUBLIC_SITE_URL"] || "https://loyal-qr-buddy.lovable.app";
    const { data: invited, error: invErr } = await db.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName, mobile: data.mobile },
      redirectTo: `${origin}/reset-password`,
    });
    if (invErr || !invited?.user) throw new Error(invErr?.message ?? "Could not create the user.");
    const userId = invited.user.id;

    let slug = slugify(data.businessName);
    const { data: taken } = await db.from("businesses").select("id").eq("slug", slug).maybeSingle();
    if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: biz, error: bErr } = await db.from("businesses").insert({
      owner_id: userId, name: data.businessName, slug, category: data.category || null,
      phone: data.mobile, email: data.email, address: data.address || null, city: data.city || null,
      status: "ACTIVE", onboarding_completed: false, created_by_admin: context.userId,
    }).select("id").single();
    if (bErr) throw new Error(bErr.message);

    await db.from("business_staff").insert({ business_id: biz.id, user_id: userId, full_name: data.fullName, email: data.email, phone: data.mobile, role: "BUSINESS_OWNER" });
    await db.from("user_roles").insert({ user_id: userId, role: "BUSINESS_OWNER" });
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    await db.from("qr_codes").insert({ business_id: biz.id, label: "Shop QR", qr_type: "BUSINESS", token });

    const { data: sub } = await db.from("subscriptions").insert({
      business_id: biz.id, plan_id: plan.id, status: "PAST_DUE", notes: data.notes || null,
    }).select("id").single();

    const { data: pay } = await db.from("payments").insert({
      business_id: biz.id, subscription_id: sub?.id ?? null, plan_id: plan.id, amount: data.amount, currency: "INR",
      provider: data.paymentMethod === "MANUAL" ? "manual" : "upi", method: data.paymentMethod,
      payment_mode: data.paymentMode || null, provider_ref: data.reference || null, status: "PENDING",
      admin_notes: data.notes || null, cycle: "YEARLY",
      paid_at: data.activationDate ? new Date(data.activationDate).toISOString() : null,
    }).select("id").single();

    if (data.paymentStatus === "PAID" && pay) {
      const { activateVerifiedPayment } = await import("@/lib/payment-activation.server");
      await activateVerifiedPayment(db as any, {
        paymentId: pay.id, adminId: context.userId,
        periodStart: data.activationDate ? new Date(data.activationDate).toISOString() : null,
        periodEnd: data.expiryDate ? new Date(data.expiryDate).toISOString() : null,
      });
    }
    await db.from("audit_logs").insert({
      business_id: biz.id, actor_id: context.userId, action: "USER_CREATED_BY_ADMIN",
      entity: "businesses", entity_id: biz.id, meta: { email: data.email, plan_id: plan.id, payment: data.paymentMethod, status: data.paymentStatus },
    });
    return { ok: true, businessId: biz.id };
  });

/** Admin changes plan / dates / branch limit / status, with mandatory reason. */
export const updateSubscriptionAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      businessId: z.string().uuid(),
      planId: z.string().uuid(),
      status: z.enum(["ACTIVE", "PAST_DUE", "CANCELLED", "SUSPENDED"]),
      periodEnd: z.string().trim().default(""),
      customMaxBranches: z.number().int().min(1).max(999).nullable().default(null),
      customPrice: z.number().min(0).max(10_000_000).nullable().default(null),
      reason: z.string().trim().min(3, "Please give a reason").max(300),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: old } = await db.from("subscriptions")
      .select("id, plan_id, status, current_period_end, custom_max_branches, custom_price").eq("business_id", data.businessId).maybeSingle();
    const patch = {
      plan_id: data.planId, status: data.status,
      current_period_end: data.periodEnd ? new Date(data.periodEnd).toISOString() : old?.current_period_end ?? null,
      custom_max_branches: data.customMaxBranches, custom_price: data.customPrice,
    };
    if (old) {
      const { error } = await db.from("subscriptions").update(patch).eq("id", old.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("subscriptions").insert({ business_id: data.businessId, ...patch });
      if (error) throw new Error(error.message);
    }
    await db.from("subscription_history").insert({
      business_id: data.businessId, admin_id: context.userId, action: "ADMIN_CHANGE",
      old_value: old ?? {}, new_value: patch, reason: data.reason,
    });
    await db.from("audit_logs").insert({
      business_id: data.businessId, actor_id: context.userId, action: "SUBSCRIPTION_CHANGED_BY_ADMIN",
      entity: "subscriptions", entity_id: old?.id ?? null, meta: { old, new: patch, reason: data.reason },
    });
    return { ok: true };
  });

export const getSubscriptionHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { data: rows } = await context.supabase.from("subscription_history")
      .select("id, action, old_value, new_value, reason, created_at").eq("business_id", data.businessId)
      .order("created_at", { ascending: false }).limit(30);
    return rows ?? [];
  });

/** Admin records a payment received outside UPI (cash, bank transfer, cheque). */
export const recordManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      businessId: z.string().uuid(),
      planId: z.string().uuid().nullable().default(null),
      addonCode: z.enum(["REVIEW_WRITER", "DIGITAL_MENU"]).nullable().default(null),
      amount: z.number().positive().max(10_000_000),
      paidAt: z.string().trim().min(8),
      mode: z.string().trim().min(2).max(40),
      reference: z.string().trim().max(60).default(""),
      notes: z.string().trim().max(500).default(""),
      markPaid: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    if (!data.planId && !data.addonCode) throw new Error("Choose a plan or an add-on.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    if (data.reference) {
      const { data: dup } = await db.from("payments").select("id").eq("provider_ref", data.reference).eq("status", "SUCCESS").maybeSingle();
      if (dup) throw new Error("A confirmed payment with this reference already exists.");
    }
    const { data: pay, error } = await db.from("payments").insert({
      business_id: data.businessId, plan_id: data.planId, addon_code: data.addonCode, amount: data.amount, currency: "INR",
      provider: "manual", method: "MANUAL", payment_mode: data.mode, provider_ref: data.reference || null,
      status: "PENDING", admin_notes: data.notes || null, paid_at: new Date(data.paidAt).toISOString(), cycle: "YEARLY",
    }).select("id").single();
    if (error) throw new Error(error.message);
    await db.from("audit_logs").insert({ business_id: data.businessId, actor_id: context.userId, action: "MANUAL_PAYMENT_RECORDED", entity: "payments", entity_id: pay.id, meta: { amount: data.amount, mode: data.mode } });
    if (data.markPaid) {
      const { activateVerifiedPayment } = await import("@/lib/payment-activation.server");
      await activateVerifiedPayment(db as any, { paymentId: pay.id, adminId: context.userId });
    }
    return { ok: true };
  });

/** Convert a UPI record to Manual. Original method/reference kept in the audit log. */
export const convertPaymentToManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      paymentId: z.string().uuid(),
      mode: z.string().trim().min(2).max(40),
      reference: z.string().trim().max(60).default(""),
      paidAt: z.string().trim().min(8),
      reason: z.string().trim().min(3, "Please give a reason").max(300),
      markPaid: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: p } = await db.from("payments").select("id, business_id, method, provider, provider_ref, status").eq("id", data.paymentId).maybeSingle();
    if (!p) throw new Error("Payment not found.");
    if (p.method === "MANUAL") throw new Error("This payment is already manual.");
    if (p.status === "SUCCESS") throw new Error("Confirmed UPI payments cannot be converted.");
    await db.from("audit_logs").insert({
      business_id: p.business_id, actor_id: context.userId, action: "PAYMENT_METHOD_CHANGED",
      entity: "payments", entity_id: p.id,
      meta: { from: { method: p.method, provider: p.provider, reference: p.provider_ref, status: p.status }, to: { method: "MANUAL", mode: data.mode, reference: data.reference }, reason: data.reason },
    });
    const { error } = await db.from("payments").update({
      method: "MANUAL", provider: "manual", payment_mode: data.mode, provider_ref: data.reference || p.provider_ref,
      paid_at: new Date(data.paidAt).toISOString(), admin_notes: data.reason, status: "PENDING",
    }).eq("id", p.id);
    if (error) throw new Error(error.message);
    if (data.markPaid) {
      const { activateVerifiedPayment } = await import("@/lib/payment-activation.server");
      await activateVerifiedPayment(db as any, { paymentId: p.id, adminId: context.userId });
    }
    return { ok: true };
  });

export const listInvoicesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ page: z.number().int().min(0).default(0) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: rows, count } = await db.from("invoices").select("*, businesses(name)", { count: "exact" })
      .order("created_at", { ascending: false }).range(data.page * 20, data.page * 20 + 19);
    return { total: count ?? 0, rows: rows ?? [] };
  });

export const saveSellerDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().trim().min(2).max(100),
      address: z.string().trim().max(300).default(""),
      gstin: z.string().trim().toUpperCase().regex(/^$|^[0-9]{2}[A-Z0-9]{13}$/, "GSTIN must be 15 characters").default(""),
      taxRate: z.number().min(0).max(28).default(0),
      email: z.string().trim().max(120).default(""),
      phone: z.string().trim().max(20).default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const at = new Date().toISOString();
    const rows = [
      ["seller_name", data.name], ["seller_address", data.address], ["seller_gstin", data.gstin],
      ["seller_tax_rate", String(data.taxRate)], ["seller_email", data.email], ["seller_phone", data.phone],
    ].map(([key, value]) => ({ key, value, updated_at: at }));
    const { error } = await context.supabase.from("platform_settings").upsert(rows);
    if (error) throw new Error(error.message);
    await context.supabase.from("audit_logs").insert({ actor_id: context.userId, action: "SELLER_DETAILS_UPDATED", entity: "platform_settings", meta: {} });
    return { ok: true };
  });
