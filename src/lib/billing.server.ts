import { createHmac, timingSafeEqual } from "crypto";

export type RazorpayConfig = { keyId: string; keySecret: string };

/** Razorpay credentials, read at call time (never at module scope). */
export function getRazorpayConfig(): RazorpayConfig | null {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function safeEqualHex(a: string, b: string) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function hmacSha256Hex(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Create an order with the Razorpay Orders API. Amount is in paise. */
export async function createRazorpayOrder(input: {
  config: RazorpayConfig;
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}) {
  const auth = Buffer.from(`${input.config.keyId}:${input.config.keySecret}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    }),
  });
  if (!res.ok) {
    // Never surface the provider's raw payload to the browser.
    console.error("razorpay order failed", res.status, await res.text());
    throw new Error("The payment provider could not start this checkout. Please try again.");
  }
  return (await res.json()) as { id: string; amount: number; currency: string };
}

export function invoiceNumber(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `DU-${y}${m}-${rand}`;
}

export function periodEnd(cycle: "MONTHLY" | "YEARLY", from = new Date()) {
  const d = new Date(from);
  if (cycle === "YEARLY") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}
