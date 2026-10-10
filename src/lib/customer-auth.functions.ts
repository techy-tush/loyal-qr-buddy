import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeIndianPhone, phoneVariants, pastDate, indianPhone } from "@/lib/validation";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function maskEmail(email: string) {
  const [u = "", d = ""] = email.split("@");
  return `${u.slice(0, 2)}${"•".repeat(Math.max(1, u.length - 2))}@${d}`;
}

function siteOrigin() {
  const origin = getRequestHeader("origin");
  if (origin && /^https?:\/\//.test(origin)) return origin;
  return "https://loyal-qr-buddy.lovable.app";
}

/**
 * Step 1 of customer login: find the registered customer and email a secure sign-in link.
 * Entering a phone/email alone never signs anyone in — only the emailed link does.
 */
export const sendCustomerLoginLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ identifier: z.string().trim().min(3).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const id = data.identifier.toLowerCase();
    let email: string | null = null;
    if (id.includes("@")) {
      const parsed = z.string().email().safeParse(id);
      if (!parsed.success) return { status: "invalid" as const };
      const { data: row } = await db.from("customers").select("email").ilike("email", id).limit(1).maybeSingle();
      email = row?.email ?? null;
      if (!email) return { status: "not_registered" as const };
    } else {
      if (!normalizeIndianPhone(id)) return { status: "invalid" as const };
      const { data: rows } = await db.from("customers").select("email").in("phone", phoneVariants(id)).limit(20);
      if (!rows?.length) return { status: "not_registered" as const };
      email = rows.find((r) => r.email)?.email ?? null;
      if (!email) return { status: "no_email" as const };
    }
    const { error } = await publicClient().auth.signInWithOtp({
      email: email.toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: `${siteOrigin()}/customer-login` },
    });
    if (error) {
      console.error("customer login link", error.message);
      return { status: "error" as const, message: "Could not send the login link. Please try again in a minute." };
    }
    return { status: "sent" as const, maskedEmail: maskEmail(email) };
  });

/** Customer registration: refuse duplicates, then email a verification link carrying the details. */
export const sendCustomerSignupLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(80).regex(/^[\p{L} .'-]+$/u, "Enter a valid name"),
        email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
        phone: indianPhone,
        dob: pastDate.optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const [{ data: byPhone }, { data: byEmail }] = await Promise.all([
      db.from("customers").select("id").in("phone", phoneVariants(data.phone)).limit(1),
      db.from("customers").select("id").ilike("email", data.email).limit(1),
    ]);
    if (byPhone?.length || byEmail?.length) return { status: "exists" as const };
    const { error } = await publicClient().auth.signInWithOtp({
      email: data.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${siteOrigin()}/customer-login`,
        data: { full_name: data.full_name, mobile: data.phone, dob: data.dob || null, account_type: "CUSTOMER" },
      },
    });
    if (error) return { status: "error" as const, message: "Could not send the verification email. Please try again." };
    return { status: "sent" as const };
  });

/** After the emailed link is opened: return this verified person's shop cards (by verified email). */
export const resolveCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String(context.claims.email ?? "").toLowerCase();
    if (!email) throw new Error("Please sign in again.");
    const db = await admin();
    const { data: rows } = await db
      .from("customers")
      .select("id, access_token, user_id, last_visit_at")
      .ilike("email", email)
      .order("last_visit_at", { ascending: false, nullsFirst: false })
      .limit(50);
    const list = rows ?? [];
    const unlinked = list.filter((r) => !r.user_id).map((r) => r.id);
    if (unlinked.length) await db.from("customers").update({ user_id: context.userId }).in("id", unlinked);
    return { customerToken: list[0]?.access_token ?? null };
  });

/** A verified customer with no shop yet joins a shop from the list. */
export const joinShopAsCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const email = String(context.claims.email ?? "").toLowerCase();
    const db = await admin();
    const { data: u } = await db.auth.admin.getUserById(context.userId);
    const meta = (u.user?.user_metadata ?? {}) as { full_name?: string; mobile?: string; dob?: string | null };
    const phone = normalizeIndianPhone(meta.mobile ?? "");
    if (!email || !phone || !meta.full_name) throw new Error("Please register as a customer first.");
    // Never attach a phone number that already belongs to someone else.
    const { data: taken } = await db.from("customers").select("email").in("phone", phoneVariants(phone)).limit(5);
    if ((taken ?? []).some((r) => (r.email ?? "").toLowerCase() !== email))
      throw new Error("This mobile number is already registered with another account.");
    const { data: biz } = await db.from("businesses").select("id, status").eq("id", data.businessId).maybeSingle();
    if (!biz || biz.status !== "ACTIVE") throw new Error("This shop is not available.");
    const { data: existing } = await db.from("customers").select("access_token").eq("business_id", biz.id).ilike("email", email).maybeSingle();
    if (existing) return { customerToken: existing.access_token };
    const { data: branch } = await db.from("branches").select("id").eq("business_id", biz.id).eq("is_active", true).order("created_at").limit(1).maybeSingle();
    const { data: created, error } = await db
      .from("customers")
      .insert({ business_id: biz.id, branch_id: branch?.id ?? null, user_id: context.userId, full_name: meta.full_name, phone, email, dob: meta.dob || null })
      .select("id, access_token")
      .single();
    if (error) throw new Error("Could not open this shop. Please try again.");
    const { data: program } = await db.from("loyalty_programs").select("id").eq("business_id", biz.id).eq("is_active", true).order("created_at").limit(1).maybeSingle();
    if (program) await db.from("loyalty_cards").insert({ business_id: biz.id, customer_id: created.id, program_id: program.id });
    return { customerToken: created.access_token };
  });
