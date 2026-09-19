/**
 * Push delivery for customer devices, through the Firebase Cloud Messaging connector.
 * Never throws — a failed push must not break a stamp, reward or offer.
 */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

export function pushConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["FIREBASE_MESSAGING_API_KEY"]);
}

type PushInput = {
  businessId: string;
  customerId?: string | null;
  title: string;
  body: string;
  path?: string;
};

export async function sendCustomerPush(input: PushInput): Promise<{
  sent: number;
  skipped: boolean;
}> {
  if (!pushConfigured()) return { sent: 0, skipped: true };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("customer_push_tokens")
      .select("id, token")
      .eq("business_id", input.businessId)
      .eq("is_active", true)
      .limit(500);
    if (input.customerId) q = q.eq("customer_id", input.customerId);

    const { data: devices } = await q;
    if (!devices || devices.length === 0) return { sent: 0, skipped: false };

    const headers = {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "X-Connection-Api-Key": process.env["FIREBASE_MESSAGING_API_KEY"]!,
      "Content-Type": "application/json",
    };

    let sent = 0;
    const stale: string[] = [];

    for (const device of devices) {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: {
            token: device.token,
            notification: { title: input.title, body: input.body },
            data: input.path ? { path: input.path } : {},
          },
        }),
      });
      if (res.ok) {
        sent += 1;
      } else {
        const text = await res.text();
        console.error(`FCM send failed [${res.status}]: ${text}`);
        if (res.status === 404 || res.status === 400) stale.push(device.id);
      }
    }

    if (stale.length > 0) {
      await supabaseAdmin
        .from("customer_push_tokens")
        .update({ is_active: false })
        .in("id", stale);
    }

    return { sent, skipped: false };
  } catch (err) {
    console.error("push send error", err);
    return { sent: 0, skipped: false };
  }
}
