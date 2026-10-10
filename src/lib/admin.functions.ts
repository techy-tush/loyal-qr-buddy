import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Throws unless the caller holds the SUPER_ADMIN platform role. */
async function assertSuperAdmin(supabase: SupabaseClient) {
  const { data } = await supabase.rpc("is_super_admin");
  if (!data) throw new Error("This area is for platform administrators only.");
}

const pageInput = z
  .object({
    search: z.string().trim().max(120).optional().default(""),
    page: z.number().int().min(0).max(500).optional().default(0),
  })
  .default({ search: "", page: 0 });

const PAGE_SIZE = 20;

export const isPlatformAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_super_admin");
    return { allowed: Boolean(data) };
  });

export const getPlatformOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const count = async (table: string, filter?: (q: any) => any) => {
      let q: any = (supabaseAdmin as any)
        .from(table)
        .select("id", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count: c } = await q;
      return c ?? 0;
    };

    const [businesses, active, suspended, pending, customers, scans, stamps, rewards, tickets] =
      await Promise.all([
        count("businesses"),
        count("businesses", (q) => q.eq("status", "ACTIVE")),
        count("businesses", (q) => q.eq("status", "SUSPENDED")),
        count("businesses", (q) => q.eq("status", "PENDING")),
        count("customers"),
        count("qr_scans"),
        count("stamp_events"),
        count("rewards"),
        count("support_tickets", (q) => q.eq("status", "OPEN")),
      ]);

    const { data: subs } = await supabaseAdmin.from("subscriptions").select("status");
    const subCounts = (subs ?? []).reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    }, {});

    const { data: paid } = await supabaseAdmin
      .from("payments")
      .select("amount, created_at")
      .eq("status", "SUCCESS");
    const revenue = (paid ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    const since = Date.now() - 30 * 86_400_000;
    const revenue30 = (paid ?? [])
      .filter((p) => new Date(p.created_at).getTime() >= since)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      businesses,
      active,
      suspended,
      pending,
      customers,
      scans,
      stamps,
      rewards,
      openTickets: tickets,
      trial: subCounts["TRIAL"] ?? 0,
      paidSubs: subCounts["ACTIVE"] ?? 0,
      cancelled: subCounts["CANCELLED"] ?? 0,
      revenue,
      revenue30,
    };
  });

export const listBusinessesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pageInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("businesses")
      .select(
        "id, name, slug, category, city, phone, email, status, owner_id, created_at, onboarding_completed",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.page * PAGE_SIZE, data.page * PAGE_SIZE + PAGE_SIZE - 1);
    if (data.search) query = query.or(`name.ilike.%${data.search}%,city.ilike.%${data.search}%`);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const ids = list.map((b) => b.id);

    const [subs, owners, customerRows] = await Promise.all([
      ids.length
        ? supabaseAdmin
            .from("subscriptions")
            .select("business_id, status, trial_ends_at, current_period_end, plans(id, name, code)")
            .in("business_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      list.length
        ? supabaseAdmin
            .from("profiles")
            .select("id, full_name, email")
            .in("id", list.map((b) => b.owner_id))
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabaseAdmin.from("customers").select("business_id").in("business_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const customerCounts = (customerRows.data ?? []).reduce<Record<string, number>>((acc, c) => {
      acc[c.business_id] = (acc[c.business_id] ?? 0) + 1;
      return acc;
    }, {});

    return {
      total: count ?? 0,
      rows: list.map((b) => {
        const sub = (subs.data ?? []).find((s: any) => s.business_id === b.id) ?? null;
        const owner = (owners.data ?? []).find((o: any) => o.id === b.owner_id) ?? null;
        return {
          ...b,
          ownerName: owner?.full_name ?? null,
          ownerEmail: owner?.email ?? null,
          planName: sub?.plans?.name ?? null,
          subStatus: sub?.status ?? null,
          trialEndsAt: sub?.trial_ends_at ?? null,
          periodEnd: sub?.current_period_end ?? null,
          customers: customerCounts[b.id] ?? 0,
        };
      }),
    };
  });

export const setBusinessStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        status: z.enum(["ACTIVE", "SUSPENDED", "PENDING"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("businesses")
      .update({ status: data.status })
      .eq("id", data.businessId);
    if (error) throw new Error(error.message);

    if (data.status === "SUSPENDED") {
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "SUSPENDED" })
        .eq("business_id", data.businessId);
    }
    await supabaseAdmin.from("audit_logs").insert({
      business_id: data.businessId,
      actor_id: context.userId,
      action: `BUSINESS_${data.status}`,
      entity: "businesses",
      entity_id: data.businessId,
      meta: {},
    });
    return { ok: true as const };
  });

export const changeBusinessPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        businessId: z.string().uuid(),
        planId: z.string().uuid(),
        status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "SUSPENDED"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id")
      .eq("business_id", data.businessId)
      .maybeSingle();

    if (sub) {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({ plan_id: data.planId, status: data.status })
        .eq("id", sub.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("subscriptions").insert({
        business_id: data.businessId,
        plan_id: data.planId,
        status: data.status,
      });
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("audit_logs").insert({
      business_id: data.businessId,
      actor_id: context.userId,
      action: "PLAN_CHANGED_BY_ADMIN",
      entity: "subscriptions",
      entity_id: sub?.id ?? null,
      meta: { plan_id: data.planId, status: data.status },
    });
    return { ok: true as const };
  });

export const listUsersAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pageInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, mobile, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.page * PAGE_SIZE, data.page * PAGE_SIZE + PAGE_SIZE - 1);
    if (data.search)
      query = query.or(`full_name.ilike.%${data.search}%,email.ilike.%${data.search}%`);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const ids = list.map((p) => p.id);

    const [roles, owned] = await Promise.all([
      ids.length
        ? supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabaseAdmin.from("businesses").select("id, name, owner_id").in("owner_id", ids)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    return {
      total: count ?? 0,
      rows: list.map((p) => ({
        ...p,
        roles: (roles.data ?? []).filter((r: any) => r.user_id === p.id).map((r: any) => r.role),
        businesses: (owned.data ?? []).filter((b: any) => b.owner_id === p.id).map((b: any) => b.name),
      })),
    };
  });

export const setSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), grant: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    if (data.userId === context.userId && !data.grant)
      throw new Error("You cannot remove your own platform admin access.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: "SUPER_ADMIN" });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "SUPER_ADMIN");
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin.from("audit_logs").insert({
      business_id: null,
      actor_id: context.userId,
      action: data.grant ? "SUPER_ADMIN_GRANTED" : "SUPER_ADMIN_REVOKED",
      entity: "user_roles",
      entity_id: null,
      meta: { user_id: data.userId },
    });
    return { ok: true as const };
  });

export const listSubscriptionsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pageInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, count, error } = await supabaseAdmin
      .from("subscriptions")
      .select(
        "id, status, trial_ends_at, current_period_end, provider, created_at, businesses(id, name), plans(id, name, code)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.page * PAGE_SIZE, data.page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    return { total: count ?? 0, rows: rows ?? [] };
  });

export const listPaymentsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pageInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, count, error } = await supabaseAdmin
      .from("payments")
      .select(
        "id, amount, currency, provider, provider_ref, status, invoice_number, created_at, businesses(id, name), plans(name)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.page * PAGE_SIZE, data.page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    return { total: count ?? 0, rows: rows ?? [] };
  });

export const listTicketsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pageInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, count, error } = await supabaseAdmin
      .from("support_tickets")
      .select(
        "id, subject, message, status, priority, admin_reply, created_at, businesses(id, name)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.page * PAGE_SIZE, data.page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    return { total: count ?? 0, rows: rows ?? [] };
  });

export const replyTicketAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        reply: z.string().trim().min(2).max(2000),
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("support_tickets")
      .update({ admin_reply: data.reply, status: data.status })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const savePlanAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        planId: z.string().uuid(),
        priceMonthly: z.number().min(0).max(1_000_000),
        priceYearly: z.number().min(0).max(10_000_000),
        maxBranches: z.number().int().min(1).max(999),
        isActive: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("plans")
      .update({
        price_monthly: data.priceMonthly,
        price_yearly: data.priceYearly,
        max_branches: data.maxBranches,
        is_active: data.isActive,
      })
      .eq("id", data.planId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listPlansAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("plans")
      .select("id, code, name, price_monthly, price_yearly, max_branches, features, is_active, sort_order")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ------------------------------ UPI settings & approvals ------------------------------ */

export const saveUpiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      upiId: z.string().trim().max(80).regex(/^$|^[A-Za-z0-9.\-_]{2,}@[A-Za-z]{2,}$/, "Enter a valid UPI ID like name@bank"),
      payee: z.string().trim().min(2).max(60),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_super_admin");
    if (!ok) throw new Error("Platform administrators only.");
    const { error } = await context.supabase.from("platform_settings").upsert([
      { key: "upi_id", value: data.upiId, updated_at: new Date().toISOString() },
      { key: "upi_payee_name", value: data.payee, updated_at: new Date().toISOString() },
    ]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const decideUpiPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ paymentId: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("is_super_admin");
    if (!ok) throw new Error("Platform administrators only.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: p } = await db.from("payments").select("id, business_id, plan_id, addon_code, cycle, status").eq("id", data.paymentId).maybeSingle();
    if (!p || p.status !== "PENDING") throw new Error("Payment not pending.");
    if (!data.approve) {
      await db.from("payments").update({ status: "FAILED" }).eq("id", p.id);
      return { ok: true };
    }
    const { invoiceNumber } = await import("@/lib/billing.server");
    const { data: marked } = await db.from("payments").update({ status: "SUCCESS", invoice_number: invoiceNumber() }).eq("id", p.id).eq("status", "PENDING").select("id");
    if (!marked?.length) throw new Error("Payment already processed.");
    // Renewals extend from the later of now or the current expiry.
    const extend = (current: string | null | undefined, months: number) => {
      const base = new Date(Math.max(Date.now(), current ? new Date(current).getTime() : 0));
      base.setUTCMonth(base.getUTCMonth() + months);
      return base.toISOString();
    };
    if (p.addon_code) {
      const { data: existing } = await db.from("business_addons").select("id, expires_at").eq("business_id", p.business_id).eq("addon_code", p.addon_code).maybeSingle();
      const expires_at = extend(existing?.expires_at, 12);
      if (existing) await db.from("business_addons").update({ status: "ACTIVE", expires_at, updated_at: new Date().toISOString() }).eq("id", existing.id);
      else await db.from("business_addons").insert({ business_id: p.business_id, addon_code: p.addon_code, status: "ACTIVE", expires_at });
      return { ok: true };
    }
    const { data: plan } = p.plan_id ? await db.from("plans").select("duration_months").eq("id", p.plan_id).maybeSingle() : { data: null };
    const months = plan?.duration_months ?? 12;
    const { data: sub } = await db.from("subscriptions").select("id, plan_id, current_period_end, status").eq("business_id", p.business_id).maybeSingle();
    const keep = sub && sub.status === "ACTIVE" && sub.plan_id === p.plan_id ? sub.current_period_end : null;
    const patch = { status: "ACTIVE" as const, provider: "upi", current_period_end: extend(keep, months), ...(p.plan_id ? { plan_id: p.plan_id } : {}) };
    if (sub) await db.from("subscriptions").update(patch).eq("id", sub.id);
    else if (p.plan_id) await db.from("subscriptions").insert({ business_id: p.business_id, plan_id: p.plan_id, ...patch });
    return { ok: true };
  });

/** Full detail of one business for the platform admin: counts, offers, customers. */
export const getBusinessDetailAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ businessId: z.string().uuid(), search: z.string().trim().max(60).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const id = data.businessId;
    const c = (t: "customers" | "offers" | "rewards" | "qr_scans" | "branches" | "visit_requests" | "offer_redemptions") =>
      db.from(t).select("id", { count: "exact", head: true }).eq("business_id", id);
    const s = data.search.replace(/[%,()*]/g, " ").trim();
    let cq = db.from("customers")
      .select("id, full_name, phone, email, total_visits, last_visit_at, access_token, created_at")
      .eq("business_id", id).order("last_visit_at", { ascending: false, nullsFirst: false }).limit(100);
    if (s) cq = cq.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`);
    const [biz, customers, offers, rewards, scans, branches, visits, redemptions, offerRows, customerRows] = await Promise.all([
      db.from("businesses").select("*").eq("id", id).single(),
      c("customers"), c("offers"), c("rewards"), c("qr_scans"), c("branches"), c("visit_requests"), c("offer_redemptions"),
      db.from("offers").select("id, title, offer_type, discount_value, is_active, starts_at, ends_at").eq("business_id", id).order("created_at", { ascending: false }),
      cq,
    ]);
    if (biz.error) throw new Error("Business not found.");
    return {
      business: biz.data,
      counts: {
        customers: customers.count ?? 0, offers: offers.count ?? 0, rewards: rewards.count ?? 0, scans: scans.count ?? 0,
        branches: branches.count ?? 0, visits: visits.count ?? 0, redemptions: redemptions.count ?? 0,
      },
      offers: offerRows.data ?? [],
      customers: customerRows.data ?? [],
    };
  });
