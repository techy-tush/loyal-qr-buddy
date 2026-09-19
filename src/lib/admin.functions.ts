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
      let q = supabaseAdmin.from(table).select("id", { count: "exact", head: true });
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
        "id, amount, currency, provider, status, invoice_number, created_at, businesses(id, name)",
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
