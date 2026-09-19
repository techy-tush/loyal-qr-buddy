import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendNotification, type Channel } from "@/lib/notify.server";

export type AutomationType = "BIRTHDAY" | "ANNIVERSARY" | "WIN_BACK" | "REWARD_EXPIRING";

const DEDUPE_DAYS: Record<AutomationType, number> = {
  BIRTHDAY: 300,
  ANNIVERSARY: 300,
  WIN_BACK: 30,
  REWARD_EXPIRING: 7,
};

const DEFAULT_MESSAGE: Record<AutomationType, string> = {
  BIRTHDAY: "Happy birthday {{name}}! Visit {{business}} today and enjoy a treat on us.",
  ANNIVERSARY: "Happy anniversary {{name}}! Celebrate with us at {{business}}.",
  WIN_BACK: "We miss you {{name}}. Come back to {{business}} and enjoy 10% OFF your next visit.",
  REWARD_EXPIRING:
    "{{name}}, your reward at {{business}} expires soon. Use code {{code}} before it runs out.",
};

const MAX_PER_CAMPAIGN = 200;
const INACTIVE_DAYS = 30;

type CustomerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  total_visits: number;
  last_visit_at: string | null;
  is_vip: boolean;
};

function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => vars[key] ?? "");
}

function mmdd(d: Date) {
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function audienceMatch(audience: string, c: CustomerRow, inactiveCutoff: number) {
  const last = c.last_visit_at ? new Date(c.last_visit_at).getTime() : 0;
  switch (audience) {
    case "NEW":
      return c.total_visits <= 1;
    case "REPEAT":
      return c.total_visits >= 2;
    case "INACTIVE":
      return last < inactiveCutoff;
    case "VIP":
      return c.is_vip;
    default:
      return true;
  }
}

export async function runAutomation(businessId?: string) {
  const now = new Date();
  const todayKey = mmdd(now);
  const inactiveCutoff = now.getTime() - INACTIVE_DAYS * 86400_000;

  let campaignQuery = supabaseAdmin
    .from("campaigns")
    .select("id, business_id, name, type, audience, channel, message, is_active")
    .eq("is_active", true);
  if (businessId) campaignQuery = campaignQuery.eq("business_id", businessId);
  const { data: campaigns, error } = await campaignQuery;
  if (error) throw new Error(error.message);

  const summary = { campaigns: 0, sent: 0, queued: 0, skipped: 0, failed: 0 };
  if (!campaigns || campaigns.length === 0) return summary;

  const businessIds = [...new Set(campaigns.map((c) => c.business_id))];
  const { data: businesses } = await supabaseAdmin
    .from("businesses")
    .select("id, name, status")
    .in("id", businessIds);
  const bizMap = new Map((businesses ?? []).map((b) => [b.id, b]));

  for (const campaign of campaigns) {
    const type = campaign.type as AutomationType;
    if (!DEDUPE_DAYS[type]) continue;
    const business = bizMap.get(campaign.business_id);
    if (!business || business.status !== "ACTIVE") continue;
    summary.campaigns += 1;

    const channel = (campaign.channel as Channel) ?? "EMAIL";
    const template = campaign.message?.trim() ? campaign.message : DEFAULT_MESSAGE[type];

    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, full_name, phone, email, total_visits, last_visit_at, is_vip, dob, anniversary")
      .eq("business_id", campaign.business_id)
      .eq("marketing_consent", true)
      .limit(2000);

    let targets: Array<{ customer: CustomerRow; code?: string }> = [];

    if (type === "BIRTHDAY" || type === "ANNIVERSARY") {
      const field = type === "BIRTHDAY" ? "dob" : "anniversary";
      targets = (customers ?? [])
        .filter((c) => {
          const raw = (c as Record<string, unknown>)[field] as string | null;
          return Boolean(raw) && raw!.slice(5, 10) === todayKey;
        })
        .map((c) => ({ customer: c as CustomerRow }));
    } else if (type === "WIN_BACK") {
      targets = (customers ?? [])
        .filter((c) => {
          const last = c.last_visit_at ? new Date(c.last_visit_at).getTime() : 0;
          return last > 0 && last < inactiveCutoff;
        })
        .map((c) => ({ customer: c as CustomerRow }));
    } else {
      const soon = new Date(now.getTime() + 3 * 86400_000).toISOString();
      const { data: rewards } = await supabaseAdmin
        .from("rewards")
        .select("id, customer_id, code, expires_at")
        .eq("business_id", campaign.business_id)
        .eq("status", "AVAILABLE")
        .not("expires_at", "is", null)
        .gt("expires_at", now.toISOString())
        .lt("expires_at", soon);
      const byId = new Map((customers ?? []).map((c) => [c.id, c as CustomerRow]));
      targets = (rewards ?? [])
        .map((r) => {
          const customer = byId.get(r.customer_id);
          return customer ? { customer, code: r.code } : null;
        })
        .filter((v): v is { customer: CustomerRow; code: string } => Boolean(v));
    }

    targets = targets
      .filter((t) => audienceMatch(campaign.audience as string, t.customer, inactiveCutoff))
      .slice(0, MAX_PER_CAMPAIGN);
    if (targets.length === 0) continue;

    // Skip anyone already contacted by this campaign inside its dedupe window.
    const since = new Date(now.getTime() - DEDUPE_DAYS[type] * 86400_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("notification_logs")
      .select("customer_id")
      .eq("campaign_id", campaign.id)
      .eq("event", type)
      .gte("created_at", since)
      .in(
        "customer_id",
        targets.map((t) => t.customer.id),
      );
    const contacted = new Set((recent ?? []).map((r) => r.customer_id));

    for (const { customer, code } of targets) {
      if (contacted.has(customer.id)) continue;
      const message = render(template, {
        name: customer.full_name.split(" ")[0] ?? customer.full_name,
        business: business.name,
        code: code ?? "",
      });
      const to = channel === "EMAIL" ? customer.email : customer.phone;
      const result = await sendNotification({
        channel,
        to,
        subject: `${business.name} — ${campaign.name}`,
        message,
      });

      if (result.status === "SENT") summary.sent += 1;
      else if (result.status === "FAILED") summary.failed += 1;
      else if (result.status === "QUEUED_NO_PROVIDER") summary.queued += 1;
      else summary.skipped += 1;

      await supabaseAdmin.from("notification_logs").insert({
        business_id: campaign.business_id,
        customer_id: customer.id,
        campaign_id: campaign.id,
        event: type,
        channel,
        provider: result.provider,
        status: result.status,
        payload: { message, to, error: result.error ?? null },
      });
    }

    await supabaseAdmin
      .from("campaigns")
      .update({ last_run_at: now.toISOString() })
      .eq("id", campaign.id);
  }

  return summary;
}
