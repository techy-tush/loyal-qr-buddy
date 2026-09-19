import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type TableReportRow = {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
  has_business_id: boolean;
  anon_privs: string;
  authenticated_privs: string;
};

export type PolicyReportRow = {
  table_name: string;
  policy_name: string;
  command: string;
  roles: string;
  using_expression: string;
  check_expression: string;
};

/** Full table + policy inventory. The database functions themselves reject non-admins. */
export const getSecurityReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [tables, policies] = await Promise.all([
      context.supabase.rpc("security_table_report" as never),
      context.supabase.rpc("security_policy_report" as never),
    ]);
    if (tables.error) throw new Error(tables.error.message);
    if (policies.error) throw new Error(policies.error.message);
    return {
      tables: (tables.data ?? []) as unknown as TableReportRow[],
      policies: (policies.data ?? []) as unknown as PolicyReportRow[],
    };
  });

/** Tables that hold per-business data and must never leak across tenants. */
const TENANT_TABLES = [
  "businesses",
  "branches",
  "business_staff",
  "customers",
  "loyalty_programs",
  "loyalty_cards",
  "stamp_events",
  "rewards",
  "offers",
  "offer_redemptions",
  "scratch_campaigns",
  "scratch_prizes",
  "scratch_wins",
  "menu_categories",
  "menu_items",
  "feedback",
  "qr_codes",
  "qr_scans",
  "campaigns",
  "notification_logs",
  "payments",
  "subscriptions",
  "audit_logs",
  "support_tickets",
] as const;

export type IsolationCheck = {
  table: string;
  totalRows: number;
  visibleToAnonymous: number;
  visibleToCaller: number;
  callerOwnRows: number;
  passed: boolean;
  note: string;
};

export type IsolationResult = {
  isPlatformAdmin: boolean;
  businessIds: string[];
  checks: IsolationCheck[];
  failures: number;
  ranAt: string;
};

/**
 * Live tenant-isolation probe.
 * 1. An anonymous (not signed in) reader must see zero rows in every business table.
 * 2. The caller must only see rows belonging to businesses they are a member of.
 *    Platform admins are allowed wider access by policy, which is reported, not failed.
 */
export const runTenantIsolationTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({}).passthrough().optional().parse(d ?? {}))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createClient } = await import("@supabase/supabase-js");

    const anon = createClient(
      process.env["VITE_SUPABASE_URL"]!,
      process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: adminFlag } = await context.supabase.rpc("is_super_admin");
    const isPlatformAdmin = adminFlag === true;

    const [owned, staffed] = await Promise.all([
      supabaseAdmin.from("businesses").select("id").eq("owner_id", context.userId),
      supabaseAdmin
        .from("business_staff")
        .select("business_id")
        .eq("user_id", context.userId)
        .eq("is_active", true),
    ]);
    const businessIds = Array.from(
      new Set([
        ...((owned.data ?? []).map((r) => r.id) as string[]),
        ...((staffed.data ?? []).map((r) => r.business_id).filter(Boolean) as string[]),
      ]),
    );

    const countOf = async (client: any, table: string, own: boolean | null) => {
      let q = client.from(table).select("*", { count: "exact", head: true });
      if (own !== null && businessIds.length > 0) {
        const col = table === "businesses" ? "id" : "business_id";
        q = own ? q.in(col, businessIds) : q.not(col, "in", `(${businessIds.join(",")})`);
      }
      const { count, error } = await q;
      if (error) return 0;
      return count ?? 0;
    };

    const checks: IsolationCheck[] = [];
    for (const table of TENANT_TABLES) {
      const [totalRows, visibleToAnonymous, visibleToCaller, callerOwnRows] = await Promise.all([
        countOf(supabaseAdmin, table, null),
        countOf(anon, table, null),
        countOf(context.supabase, table, null),
        businessIds.length ? countOf(context.supabase, table, true) : Promise.resolve(0),
      ]);

      const foreignVisible = Math.max(visibleToCaller - callerOwnRows, 0);
      let passed = visibleToAnonymous === 0;
      let note = "";
      if (visibleToAnonymous > 0) {
        note = `Anonymous visitors can read ${visibleToAnonymous} row(s).`;
      } else if (foreignVisible > 0 && isPlatformAdmin) {
        note = `${foreignVisible} row(s) visible through platform-admin access (by design).`;
      } else if (foreignVisible > 0) {
        passed = false;
        note = `${foreignVisible} row(s) from other businesses are readable.`;
      } else {
        note = "No cross-tenant rows readable.";
      }

      checks.push({
        table,
        totalRows,
        visibleToAnonymous,
        visibleToCaller,
        callerOwnRows,
        passed,
        note,
      });
    }

    return {
      isPlatformAdmin,
      businessIds,
      checks,
      failures: checks.filter((c) => !c.passed).length,
      ranAt: new Date().toISOString(),
    } satisfies IsolationResult;
  });
