import type { SupabaseClient } from "@supabase/supabase-js";

const extend = (current: string | null | undefined, months: number, from?: string | null) => {
  const startMs = from ? new Date(from).getTime() : Date.now();
  const base = new Date(Math.max(startMs, current ? new Date(current).getTime() : 0));
  base.setUTCMonth(base.getUTCMonth() + months);
  return base.toISOString();
};

/**
 * Marks a verified payment as paid exactly once, activates the plan or add-on,
 * and creates one invoice. Safe to call twice: the second call is a no-op.
 */
export async function activateVerifiedPayment(
  db: SupabaseClient,
  opts: { paymentId: string; adminId: string; periodStart?: string | null; periodEnd?: string | null },
) {
  const { data: p } = await db
    .from("payments")
    .select("id, business_id, plan_id, addon_code, status, amount, method, provider_ref, payment_mode, paid_at")
    .eq("id", opts.paymentId)
    .maybeSingle();
  if (!p) throw new Error("Payment not found.");
  if (p.status === "SUCCESS") throw new Error("This payment is already confirmed.");
  if (!["PENDING", "VERIFICATION_REQUIRED"].includes(p.status)) throw new Error("Only pending payments can be confirmed.");

  const now = new Date().toISOString();
  const { data: marked } = await db
    .from("payments")
    .update({ status: "SUCCESS", verified_by: opts.adminId, verified_at: now, paid_at: p.paid_at ?? now })
    .eq("id", p.id)
    .in("status", ["PENDING", "VERIFICATION_REQUIRED"])
    .select("id");
  if (!marked?.length) throw new Error("Payment already processed.");

  let itemName = "Subscription";
  let validity = "";
  let periodStart: string = opts.periodStart ?? now;
  let periodEnd: string;

  if (p.addon_code) {
    const { data: addon } = await db.from("addons").select("name").eq("code", p.addon_code).maybeSingle();
    const { data: existing } = await db.from("business_addons").select("id, expires_at").eq("business_id", p.business_id).eq("addon_code", p.addon_code).maybeSingle();
    periodEnd = opts.periodEnd ?? extend(existing?.expires_at, 12, opts.periodStart);
    if (existing) await db.from("business_addons").update({ status: "ACTIVE", expires_at: periodEnd, updated_at: now }).eq("id", existing.id);
    else await db.from("business_addons").insert({ business_id: p.business_id, addon_code: p.addon_code, status: "ACTIVE", expires_at: periodEnd });
    itemName = `${addon?.name ?? p.addon_code} (add-on)`;
    validity = "12 months";
  } else {
    const { data: plan } = p.plan_id ? await db.from("plans").select("name, duration_months").eq("id", p.plan_id).maybeSingle() : { data: null };
    const months = plan?.duration_months ?? 12;
    const { data: sub } = await db.from("subscriptions").select("id, plan_id, current_period_end, status").eq("business_id", p.business_id).maybeSingle();
    const keep = sub && sub.status === "ACTIVE" && sub.plan_id === p.plan_id ? sub.current_period_end : null;
    if (keep && new Date(keep) > new Date() && !opts.periodStart) periodStart = keep;
    periodEnd = opts.periodEnd ?? extend(keep, months, opts.periodStart);
    const patch = { status: "ACTIVE" as const, provider: p.method === "MANUAL" ? "manual" : "upi", current_period_end: periodEnd, activated_at: now, ...(p.plan_id ? { plan_id: p.plan_id } : {}) };
    let subId = sub?.id ?? null;
    if (sub) await db.from("subscriptions").update(patch).eq("id", sub.id);
    else if (p.plan_id) {
      const { data: ins } = await db.from("subscriptions").insert({ business_id: p.business_id, plan_id: p.plan_id, ...patch }).select("id").single();
      subId = ins?.id ?? null;
    }
    if (subId) await db.from("payments").update({ subscription_id: subId }).eq("id", p.id);
    await db.from("subscription_history").insert({
      business_id: p.business_id, admin_id: opts.adminId, action: "ACTIVATED",
      old_value: sub ?? {}, new_value: patch, reason: `Payment ${p.id.slice(0, 8)} verified`,
    });
    itemName = `${plan?.name ?? "Plan"} subscription`;
    validity = `${months} months`;
  }

  // Invoice — unique per payment.
  const { data: inv } = await db.from("invoices").select("invoice_number").eq("payment_id", p.id).maybeSingle();
  let invoiceNumber = inv?.invoice_number as string | undefined;
  if (!invoiceNumber) {
    const [{ data: num }, { data: biz }, { data: settings }] = await Promise.all([
      db.rpc("next_invoice_number"),
      db.from("businesses").select("name, address, city, state, pincode, phone, email").eq("id", p.business_id).maybeSingle(),
      db.from("platform_settings").select("key, value"),
    ]);
    const s = (k: string) => settings?.find((x: any) => x.key === k)?.value?.trim() || "";
    const taxRate = Number(s("seller_tax_rate")) || 0;
    const gstin = s("seller_gstin");
    const amount = Number(p.amount);
    // Prices are tax-inclusive; tax is only shown when a GSTIN and rate are configured.
    const taxAmount = gstin && taxRate > 0 ? Math.round((amount - amount / (1 + taxRate / 100)) * 100) / 100 : 0;
    invoiceNumber = String(num);
    await db.from("invoices").insert({
      invoice_number: invoiceNumber, payment_id: p.id, business_id: p.business_id,
      item_name: itemName, validity, period_start: periodStart, period_end: periodEnd,
      amount, discount: 0, tax_rate: gstin ? taxRate : 0, tax_amount: taxAmount, total: amount,
      method: p.method === "MANUAL" ? `Manual${p.payment_mode ? ` (${p.payment_mode})` : ""}` : "UPI",
      reference: p.provider_ref, status: "PAID",
      billing: biz ?? {},
      seller: { name: s("seller_name") || "Digital Udyam", address: s("seller_address"), gstin, email: s("seller_email"), phone: s("seller_phone") },
    });
    await db.from("payments").update({ invoice_number: invoiceNumber }).eq("id", p.id);
  }
  await db.from("audit_logs").insert({
    business_id: p.business_id, actor_id: opts.adminId, action: "PAYMENT_VERIFIED",
    entity: "payments", entity_id: p.id, meta: { invoice_number: invoiceNumber, method: p.method },
  });
  await db.from("audit_logs").insert({
    business_id: p.business_id, actor_id: opts.adminId, action: "INVOICE_GENERATED",
    entity: "invoices", entity_id: p.id, meta: { invoice_number: invoiceNumber },
  });
  return { invoiceNumber };
}
