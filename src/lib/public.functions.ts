import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function addDays(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString();
}

/* ------------------------------ QR landing ------------------------------ */

export const getQrLanding = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(4) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: qr } = await db
      .from("qr_codes")
      .select("id, business_id, branch_id, qr_type, is_active")
      .eq("token", data.token)
      .maybeSingle();
    if (!qr || !qr.is_active) throw new Error("This QR code is not valid or has been disabled.");

    const [{ data: business }, { data: program }, { data: offers }, { data: branch }] =
      await Promise.all([
        db
          .from("businesses")
          .select("id, name, slug, logo_url, category, city, stamp_mode, google_review_url, instagram_url, whatsapp_number")
          .eq("id", qr.business_id)
          .single(),
        db
          .from("loyalty_programs")
          .select("id, name, stamps_required, reward_description")
          .eq("business_id", qr.business_id)
          .eq("is_active", true)
          .order("created_at")
          .limit(1)
          .maybeSingle(),
        db
          .from("offers")
          .select("id, title, description, offer_type, discount_value")
          .eq("business_id", qr.business_id)
          .eq("is_active", true)
          .limit(3),
        qr.branch_id
          ? db.from("branches").select("id, name, address").eq("id", qr.branch_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    await db.from("qr_scans").insert({
      business_id: qr.business_id,
      qr_id: qr.id,
      branch_id: qr.branch_id,
    });
    const { data: counter } = await db
      .from("qr_codes")
      .select("scan_count")
      .eq("id", qr.id)
      .single();
    await db
      .from("qr_codes")
      .update({ scan_count: (counter?.scan_count ?? 0) + 1 })
      .eq("id", qr.id);

    return { qr, business, program, offers: offers ?? [], branch };
  });

/* ------------------------------ Join loyalty ------------------------------ */

export const joinLoyalty = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(4),
        full_name: z.string().max(80).optional().or(z.literal("")),
        phone: z.string().trim().min(6).max(20),
        email: z.string().email().optional().or(z.literal("")),
        dob: z.string().optional().or(z.literal("")),
        anniversary: z.string().optional().or(z.literal("")),
        marketing_consent: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: qr } = await db
      .from("qr_codes")
      .select("id, business_id, branch_id, is_active")
      .eq("token", data.token)
      .maybeSingle();
    if (!qr || !qr.is_active) throw new Error("This QR code is not valid.");

    const { data: existing } = await db
      .from("customers")
      .select("id, access_token")
      .eq("business_id", qr.business_id)
      .eq("phone", data.phone)
      .maybeSingle();

    let customerId = existing?.id;
    let accessToken = existing?.access_token;

    if (!customerId) {
      // Same person at another shop? Reuse their account details.
      const { data: other } = await db
        .from("customers")
        .select("full_name, email, dob, anniversary, marketing_consent")
        .eq("phone", data.phone)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      const { data: created, error } = await db
        .from("customers")
        .insert({
          business_id: qr.business_id,
          branch_id: qr.branch_id,
          full_name: data.full_name?.trim() || other?.full_name || "Customer",
          phone: data.phone,
          email: data.email || other?.email || null,
          dob: data.dob || other?.dob || null,
          anniversary: data.anniversary || other?.anniversary || null,
          marketing_consent: other?.marketing_consent ?? data.marketing_consent,
        })
        .select("id, access_token")
        .single();
      if (error) throw new Error(error.message);
      customerId = created.id;
      accessToken = created.access_token;
    }

    const { data: program } = await db
      .from("loyalty_programs")
      .select("id")
      .eq("business_id", qr.business_id)
      .eq("is_active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (program) {
      const { data: card } = await db
        .from("loyalty_cards")
        .select("id")
        .eq("customer_id", customerId)
        .eq("program_id", program.id)
        .maybeSingle();
      if (!card) {
        await db.from("loyalty_cards").insert({
          business_id: qr.business_id,
          customer_id: customerId,
          program_id: program.id,
        });
      }
    }

    // The scan itself was already counted when the QR page opened — don't count it twice.

    return { customerToken: accessToken! };
  });

/* ------------------------------ Customer portal ------------------------------ */

export const getCustomerPortal = createServerFn({ method: "GET" })
  .inputValidator((d: { customerToken: string }) =>
    z.object({ customerToken: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: customer } = await db
      .from("customers")
      .select("id, business_id, full_name, phone, total_visits, last_visit_at, created_at")
      .eq("access_token", data.customerToken)
      .maybeSingle();
    if (!customer) throw new Error("We couldn't find your loyalty card.");

    const [{ data: business }, { data: card }, { data: rewards }, { data: offers }, { data: campaign }] =
      await Promise.all([
        db
          .from("businesses")
          .select("id, name, slug, logo_url, category, address, city, phone, google_review_url, instagram_url, whatsapp_number, facebook_url, google_maps_url, stamp_mode")
          .eq("id", customer.business_id)
          .single(),
        db
          .from("loyalty_cards")
          .select("id, stamps, cycles_completed, program:loyalty_programs(id, name, stamps_required, reward_description)")
          .eq("customer_id", customer.id)
          .maybeSingle(),
        db
          .from("rewards")
          .select("id, code, description, status, expires_at, created_at")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false }),
        db
          .from("offers")
          .select("id, title, description, offer_type, discount_value, ends_at")
          .eq("business_id", customer.business_id)
          .eq("is_active", true),
        db
          .from("scratch_campaigns")
          .select("id, name")
          .eq("business_id", customer.business_id)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    let scratchAvailable = false;
    if (campaign) {
      const { data: win } = await db
        .from("scratch_wins")
        .select("id, prize:scratch_prizes(label, is_win)")
        .eq("campaign_id", campaign.id)
        .eq("customer_id", customer.id)
        .maybeSingle();
      scratchAvailable = !win;
    }

    return {
      customer,
      business,
      card,
      rewards: rewards ?? [],
      offers: offers ?? [],
      campaign,
      scratchAvailable,
    };
  });

/* ------------------------------ Self stamp ------------------------------ */

export const selfStamp = createServerFn({ method: "POST" })
  .inputValidator((d: { customerToken: string }) =>
    z.object({ customerToken: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: customer } = await db
      .from("customers")
      .select("id, business_id, branch_id")
      .eq("access_token", data.customerToken)
      .maybeSingle();
    if (!customer) throw new Error("Loyalty card not found.");
    const { data: business } = await db
      .from("businesses")
      .select("stamp_mode")
      .eq("id", customer.business_id)
      .single();
    if (!business || business.stamp_mode !== "SELF_SCAN")
      throw new Error("This business requires staff approval for stamps.");
    const { issueStampCore } = await import("@/lib/stamp.server");
    return issueStampCore({
      customerId: customer.id,
      businessId: customer.business_id,
      branchId: customer.branch_id,
      source: "SELF_SCAN",
      actorId: null,
    });
  });

/* ------------------------------ Scratch card ------------------------------ */

export const playScratch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ customerToken: z.string().min(8), campaignId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: customer } = await db
      .from("customers")
      .select("id, business_id")
      .eq("access_token", data.customerToken)
      .maybeSingle();
    if (!customer) throw new Error("Loyalty card not found.");

    const { data: campaign } = await db
      .from("scratch_campaigns")
      .select("id, business_id, is_active, starts_at, ends_at")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (!campaign || campaign.business_id !== customer.business_id || !campaign.is_active)
      throw new Error("This scratch campaign is not available.");
    const today = new Date().toISOString().slice(0, 10);
    if ((campaign.starts_at && campaign.starts_at > today) || (campaign.ends_at && campaign.ends_at < today))
      throw new Error("This scratch campaign is not running right now.");

    const { data: existing } = await db
      .from("scratch_wins")
      .select("id, prize:scratch_prizes(label, is_win, reward_description)")
      .eq("campaign_id", campaign.id)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (existing) throw new Error("You have already played this scratch card.");

    const { data: prizes } = await db
      .from("scratch_prizes")
      .select("id, label, probability, reward_description, is_win, expiry_days")
      .eq("campaign_id", campaign.id);
    if (!prizes || prizes.length === 0) throw new Error("No prizes configured.");

    const total = prizes.reduce((s, p) => s + Number(p.probability), 0);
    let roll = Math.random() * (total > 0 ? total : 1);
    let chosen = prizes[prizes.length - 1]!;
    for (const p of prizes) {
      roll -= Number(p.probability);
      if (roll <= 0) {
        chosen = p;
        break;
      }
    }

    let rewardCode: string | null = null;
    let rewardId: string | null = null;
    if (chosen.is_win) {
      const { data: reward, error } = await db
        .from("rewards")
        .insert({
          business_id: customer.business_id,
          customer_id: customer.id,
          description: chosen.reward_description || chosen.label,
          source: "SCRATCH",
          expires_at: addDays(chosen.expiry_days ?? 14),
        })
        .select("id, code")
        .single();
      if (error) throw new Error(error.message);
      rewardCode = reward.code;
      rewardId = reward.id;
    }

    const { error: winError } = await db.from("scratch_wins").insert({
      business_id: customer.business_id,
      campaign_id: campaign.id,
      prize_id: chosen.id,
      customer_id: customer.id,
      reward_id: rewardId,
    });
    if (winError) throw new Error("You have already played this scratch card.");

    return { label: chosen.label, isWin: chosen.is_win, rewardCode };
  });

/* ------------------------------ Feedback ------------------------------ */

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        customerToken: z.string().min(8),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(1000).optional().or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: customer } = await db
      .from("customers")
      .select("id, business_id, branch_id")
      .eq("access_token", data.customerToken)
      .maybeSingle();
    if (!customer) throw new Error("Loyalty card not found.");
    const { error } = await db.from("feedback").insert({
      business_id: customer.business_id,
      branch_id: customer.branch_id,
      customer_id: customer.id,
      rating: data.rating,
      comment: data.comment || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ Public menu ------------------------------ */

export const getPublicMenu = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: business } = await db
      .from("businesses")
      .select("id, name, logo_url, city, phone, whatsapp_number, instagram_url")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!business) throw new Error("Menu not found.");
    const [{ data: categories }, { data: items }] = await Promise.all([
      db.from("menu_categories").select("id, name, sort_order").eq("business_id", business.id).order("sort_order"),
      db
        .from("menu_items")
        .select("id, category_id, name, description, price, image_url, is_available, sort_order")
        .eq("business_id", business.id)
        .order("sort_order"),
    ]);
    return { business, categories: categories ?? [], items: items ?? [] };
  });

/* ------------------------------ Contact ------------------------------ */

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(2).max(80),
        email: z.string().email(),
        message: z.string().min(5).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("support_tickets").insert({
      subject: `Website enquiry from ${data.name}`,
      message: `${data.message}\n\nReply to: ${data.email}`,
      priority: "NORMAL",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------ Visit requests ------------------------------ */

export const requestVisit = createServerFn({ method: "POST" })
  .inputValidator((d: { customerToken: string }) =>
    z.object({ customerToken: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: customer } = await db
      .from("customers")
      .select("id, business_id, branch_id")
      .eq("access_token", data.customerToken)
      .maybeSingle();
    if (!customer) throw new Error("Loyalty card not found.");
    const { data: pending } = await db
      .from("visit_requests")
      .select("id, status, created_at")
      .eq("customer_id", customer.id)
      .eq("status", "PENDING")
      .maybeSingle();
    if (pending) return pending;
    const { data: created, error } = await db
      .from("visit_requests")
      .insert({ business_id: customer.business_id, customer_id: customer.id, branch_id: customer.branch_id })
      .select("id, status, created_at")
      .single();
    if (error) throw new Error("Could not send your request. Please try again.");
    return created;
  });

export const getVisitStatus = createServerFn({ method: "GET" })
  .inputValidator((d: { customerToken: string }) =>
    z.object({ customerToken: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: customer } = await db
      .from("customers").select("id").eq("access_token", data.customerToken).maybeSingle();
    if (!customer) throw new Error("Loyalty card not found.");
    const { data: last } = await db
      .from("visit_requests")
      .select("id, status, created_at, decided_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return last ?? null;
  });

export const updateCustomerProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        customerToken: z.string().min(8),
        full_name: z.string().trim().min(2).max(80),
        email: z.string().trim().email().max(120).optional().or(z.literal("")),
        dob: z.string().optional().or(z.literal("")),
        anniversary: z.string().optional().or(z.literal("")),
        marketing_consent: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("customers")
      .update({
        full_name: data.full_name,
        email: data.email || null,
        dob: data.dob || null,
        anniversary: data.anniversary || null,
        marketing_consent: data.marketing_consent,
      })
      .eq("access_token", data.customerToken);
    if (error) throw new Error("Could not save your profile.");
    return { ok: true };
  });

export const getCustomerProfile = createServerFn({ method: "GET" })
  .inputValidator((d: { customerToken: string }) =>
    z.object({ customerToken: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: c } = await db
      .from("customers")
      .select("full_name, phone, email, dob, anniversary, marketing_consent")
      .eq("access_token", data.customerToken)
      .maybeSingle();
    if (!c) throw new Error("Loyalty card not found.");
    return c;
  });

/* ------------------------------ Explore businesses ------------------------------ */

export const exploreBusinesses = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ q: z.string().trim().max(60).default(""), city: z.string().trim().max(60).default("") }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const clean = (s: string) => s.replace(/[%,()*]/g, " ").trim();
    let query = db
      .from("businesses")
      .select("id, name, slug, category, city, state, address, logo_url")
      .eq("status", "ACTIVE")
      .order("name")
      .limit(60);
    const q = clean(data.q);
    const city = clean(data.city);
    if (q) query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%`);
    if (city) query = query.or(`city.ilike.%${city}%,address.ilike.%${city}%,pincode.ilike.%${city}%,state.ilike.%${city}%`);
    const { data: rows } = await query;
    const { data: cityRows } = await db.from("businesses").select("city").eq("status", "ACTIVE").not("city", "is", null).limit(500);
    const cities = Array.from(new Set((cityRows ?? []).map((r) => (r.city ?? "").trim()).filter(Boolean))).sort();
    return { businesses: rows ?? [], cities };
  });

/* ------------------------------ One customer account (by phone) ------------------------------ */

async function ensureCard(db: Awaited<ReturnType<typeof admin>>, businessId: string, customerId: string) {
  const { data: program } = await db
    .from("loyalty_programs").select("id").eq("business_id", businessId).eq("is_active", true)
    .order("created_at").limit(1).maybeSingle();
  if (!program) return;
  const { data: card } = await db
    .from("loyalty_cards").select("id").eq("customer_id", customerId).eq("program_id", program.id).maybeSingle();
  if (!card) await db.from("loyalty_cards").insert({ business_id: businessId, customer_id: customerId, program_id: program.id });
}

export const getMyShops = createServerFn({ method: "GET" })
  .inputValidator((d: { customerToken: string }) => z.object({ customerToken: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: me } = await db.from("customers").select("phone").eq("access_token", data.customerToken).maybeSingle();
    if (!me) throw new Error("Account not found.");
    const { data: rows } = await db
      .from("customers")
      .select("id, business_id, access_token, total_visits, last_visit_at, businesses(name, logo_url, city, category)")
      .eq("phone", me.phone)
      .order("last_visit_at", { ascending: false, nullsFirst: false })
      .limit(50);
    const list = rows ?? [];
    const ids = list.map((r) => r.id);
    const bizIds = list.map((r) => r.business_id);
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: rewards }, { data: offers }] = await Promise.all([
      ids.length ? db.from("rewards").select("customer_id").in("customer_id", ids).eq("status", "AVAILABLE") : Promise.resolve({ data: [] as { customer_id: string }[] }),
      bizIds.length ? db.from("offers").select("business_id, ends_at").in("business_id", bizIds).eq("is_active", true) : Promise.resolve({ data: [] as { business_id: string; ends_at: string | null }[] }),
    ]);
    return list.map((r) => {
      const b = (Array.isArray(r.businesses) ? r.businesses[0] : r.businesses) as { name: string; logo_url: string | null; city: string | null; category: string | null } | null;
      return {
        businessId: r.business_id,
        token: r.access_token,
        name: b?.name ?? "Shop",
        logo_url: b?.logo_url ?? null,
        city: b?.city ?? null,
        category: b?.category ?? null,
        visits: r.total_visits,
        rewards: (rewards ?? []).filter((x) => x.customer_id === r.id).length,
        offers: (offers ?? []).filter((o) => o.business_id === r.business_id && (!o.ends_at || o.ends_at >= today)).length,
      };
    });
  });

export const visitBusiness = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ customerToken: z.string().min(8), businessId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: me } = await db
      .from("customers").select("full_name, phone, email, dob, anniversary, marketing_consent")
      .eq("access_token", data.customerToken).maybeSingle();
    if (!me) throw new Error("Account not found. Please sign in with your mobile number again.");
    const { data: biz } = await db.from("businesses").select("id, status").eq("id", data.businessId).maybeSingle();
    if (!biz || biz.status !== "ACTIVE") throw new Error("This shop is not available.");
    const { data: existing } = await db
      .from("customers").select("id, access_token").eq("business_id", biz.id).eq("phone", me.phone).maybeSingle();
    if (existing) {
      await ensureCard(db, biz.id, existing.id);
      return { customerToken: existing.access_token };
    }
    const { data: branch } = await db.from("branches").select("id").eq("business_id", biz.id).eq("is_active", true).order("created_at").limit(1).maybeSingle();
    const { data: created, error } = await db
      .from("customers")
      .insert({ business_id: biz.id, branch_id: branch?.id ?? null, full_name: me.full_name, phone: me.phone, email: me.email, dob: me.dob, anniversary: me.anniversary, marketing_consent: me.marketing_consent })
      .select("id, access_token").single();
    if (error) throw new Error("Could not open this shop. Please try again.");
    await ensureCard(db, biz.id, created.id);
    return { customerToken: created.access_token };
  });
