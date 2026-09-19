/**
 * Provider-agnostic notification sending.
 *
 * Each channel resolves a provider at call time from environment secrets.
 * When no provider is configured the message is still recorded in
 * notification_logs with status QUEUED_NO_PROVIDER so nothing is silently lost
 * and the business can see exactly what would have gone out.
 */

export type Channel = "EMAIL" | "SMS" | "WHATSAPP";

export type SendResult = {
  provider: string;
  status: "SENT" | "FAILED" | "QUEUED_NO_PROVIDER" | "SKIPPED_NO_ADDRESS";
  error?: string;
};

export type SendInput = {
  channel: Channel;
  to: string | null;
  subject: string;
  message: string;
};

function env(name: string) {
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

async function sendEmail(to: string, subject: string, message: string): Promise<SendResult> {
  const apiKey = env("LOVABLE_API_KEY");
  const from = env("NOTIFY_EMAIL_FROM");
  if (!apiKey || !from) return { provider: "none", status: "QUEUED_NO_PROVIDER" };
  try {
    const res = await fetch("https://api.lovable.dev/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to,
        subject,
        html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6">${message}</div>`,
      }),
    });
    if (!res.ok) return { provider: "lovable_email", status: "FAILED", error: `http_${res.status}` };
    return { provider: "lovable_email", status: "SENT" };
  } catch {
    return { provider: "lovable_email", status: "FAILED", error: "network_error" };
  }
}

async function sendTwilio(
  to: string,
  message: string,
  kind: "SMS" | "WHATSAPP",
): Promise<SendResult> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const token = env("TWILIO_AUTH_TOKEN");
  const fromSms = env("TWILIO_SMS_FROM");
  const fromWa = env("TWILIO_WHATSAPP_FROM");
  const from = kind === "SMS" ? fromSms : fromWa;
  if (!sid || !token || !from) return { provider: "none", status: "QUEUED_NO_PROVIDER" };

  const body = new URLSearchParams({
    To: kind === "WHATSAPP" ? `whatsapp:${to}` : to,
    From: kind === "WHATSAPP" ? `whatsapp:${from}` : from,
    Body: message,
  });
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      },
      body,
    });
    if (!res.ok) return { provider: "twilio", status: "FAILED", error: `http_${res.status}` };
    return { provider: "twilio", status: "SENT" };
  } catch {
    return { provider: "twilio", status: "FAILED", error: "network_error" };
  }
}

export async function sendNotification(input: SendInput): Promise<SendResult> {
  const to = input.to?.trim();
  if (!to) return { provider: "none", status: "SKIPPED_NO_ADDRESS" };
  if (input.channel === "EMAIL") return sendEmail(to, input.subject, input.message);
  if (input.channel === "SMS") return sendTwilio(to, input.message, "SMS");
  return sendTwilio(to, input.message, "WHATSAPP");
}

export function channelConfigured(channel: Channel) {
  if (channel === "EMAIL") return Boolean(env("LOVABLE_API_KEY") && env("NOTIFY_EMAIL_FROM"));
  const base = Boolean(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN"));
  if (channel === "SMS") return base && Boolean(env("TWILIO_SMS_FROM"));
  return base && Boolean(env("TWILIO_WHATSAPP_FROM"));
}
