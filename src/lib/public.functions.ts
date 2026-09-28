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
        full_name: z.string().min(2).max(80),
        phone: z.string().min(6).max(20),
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
      const { data: created, error } = await db
        .from("customers")
        .insert({
          business_id: qr.business_id,
          branch_id: qr.branch_id,
          full_name: data.full_name,
          phone: data.phone,
          email: data.email || null,
          dob: data.dob || null,
          anniversary: data.anniversary || null,
          marketing_consent: data.marketing_consent,
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

    await db.from("qr_scans").insert({
      business_id: qr.business_id,
      qr_id: qr.id,
      branch_id: qr.branch_id,
      customer_id: customerId,
    });

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
          .select("id, name, slug, logo_url, google_review_url, instagram_url, whatsapp_number, stamp_mode")
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
