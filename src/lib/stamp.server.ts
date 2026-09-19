import { supabaseAdmin as db } from "@/integrations/supabase/client.server";

export type IssueStampInput = {
  customerId: string;
  businessId: string;
  branchId?: string | null;
  source: "STAFF" | "SELF_SCAN";
  actorId: string | null;
};

/**
 * Server-only stamp engine. Never trust a client-supplied stamp count:
 * cooldown, daily limit, reward creation and audit logging all happen here.
 */
export async function issueStampCore(input: IssueStampInput) {
  const { data: business } = await db
    .from("businesses")
    .select("id, stamp_cooldown_minutes, daily_stamp_limit")
    .eq("id", input.businessId)
    .single();
  if (!business) throw new Error("Business not found.");

  const { data: customer } = await db
    .from("customers")
    .select("id, business_id, total_visits")
    .eq("id", input.customerId)
    .single();
  if (!customer || customer.business_id !== input.businessId)
    throw new Error("This customer does not belong to this business.");

  const cooldownFrom = new Date(
    Date.now() - (business.stamp_cooldown_minutes ?? 0) * 60000,
  ).toISOString();
  const { data: recent } = await db
    .from("stamp_events")
    .select("id")
    .eq("customer_id", customer.id)
    .gte("created_at", cooldownFrom)
    .limit(1);
  if (recent && recent.length > 0)
    throw new Error(
      `A stamp was already issued in the last ${business.stamp_cooldown_minutes} minutes.`,
    );

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const { count: todayCount } = await db
    .from("stamp_events")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customer.id)
    .gte("created_at", dayStart.toISOString());
  if ((todayCount ?? 0) >= (business.daily_stamp_limit ?? 1))
    throw new Error("Daily stamp limit reached for this customer.");

  if (input.branchId) {
    const { data: branch } = await db
      .from("branches")
      .select("id, business_id")
      .eq("id", input.branchId)
      .maybeSingle();
    if (!branch || branch.business_id !== input.businessId)
      throw new Error("Invalid branch for this business.");
  }

  const { data: program } = await db
    .from("loyalty_programs")
    .select("id, stamps_required, reward_description, reward_expiry_days")
    .eq("business_id", input.businessId)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!program) throw new Error("No active loyalty program for this business.");

  let { data: card } = await db
    .from("loyalty_cards")
    .select("id, stamps, cycles_completed")
    .eq("customer_id", customer.id)
    .eq("program_id", program.id)
    .maybeSingle();

  if (!card) {
    const { data: created, error } = await db
      .from("loyalty_cards")
      .insert({
        business_id: input.businessId,
        customer_id: customer.id,
        program_id: program.id,
      })
      .select("id, stamps, cycles_completed")
      .single();
    if (error) throw new Error(error.message);
    card = created;
  }

  await db.from("stamp_events").insert({
    business_id: input.businessId,
    branch_id: input.branchId ?? null,
    customer_id: customer.id,
    card_id: card.id,
    issued_by: input.actorId,
    source: input.source,
  });

  let stamps = card.stamps + 1;
  let cycles = card.cycles_completed;
  let rewardCode: string | null = null;

  if (stamps >= program.stamps_required) {
    stamps = 0;
    cycles += 1;
    const { data: reward, error } = await db
      .from("rewards")
      .insert({
        business_id: input.businessId,
        customer_id: customer.id,
        program_id: program.id,
        description: program.reward_description,
        source: "LOYALTY",
        expires_at: new Date(
          Date.now() + (program.reward_expiry_days ?? 30) * 86400000,
        ).toISOString(),
      })
      .select("code")
      .single();
    if (error) throw new Error(error.message);
    rewardCode = reward.code;
  }

  await db.from("loyalty_cards").update({ stamps, cycles_completed: cycles }).eq("id", card.id);
  await db
    .from("customers")
    .update({ total_visits: customer.total_visits + 1, last_visit_at: new Date().toISOString() })
    .eq("id", customer.id);

  await db.from("audit_logs").insert({
    business_id: input.businessId,
    actor_id: input.actorId,
    action: rewardCode ? "STAMP_ISSUED_REWARD_UNLOCKED" : "STAMP_ISSUED",
    entity: "loyalty_card",
    entity_id: card.id,
    meta: { customer_id: customer.id, source: input.source },
  });

  if (rewardCode) {
    const { sendCustomerPush } = await import("@/lib/push.server");
    await sendCustomerPush({
      businessId: input.businessId,
      customerId: customer.id,
      title: "Reward unlocked!",
      body: `${program.reward_description} — show code ${rewardCode} at the counter.`,
    });
  }


  return {
    stamps,
    stampsRequired: program.stamps_required,
    rewardUnlocked: Boolean(rewardCode),
    rewardCode,
  };
}
