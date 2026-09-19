import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const eventSchema = z.object({
  event: z.string().min(1).max(64),
  payload: z
    .object({
      payment: z
        .object({
          entity: z
            .object({
              order_id: z.string().min(6).max(64).nullable().optional(),
              amount: z.number().optional(),
            })
            .passthrough(),
        })
        .optional(),
    })
    .passthrough(),
});

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const signature = request.headers.get("x-razorpay-signature");
        const body = await request.text();
        const { hmacSha256Hex, safeEqualHex, invoiceNumber, periodEnd } = await import(
          "@/lib/billing.server"
        );
        if (!signature || !safeEqualHex(hmacSha256Hex(secret, body), signature))
          return new Response("Invalid signature", { status: 401 });

        const parsed = eventSchema.safeParse(JSON.parse(body));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { event, payload } = parsed.data;
        const orderId = payload.payment?.entity.order_id ?? null;
        if (!orderId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("id, business_id, status")
          .eq("provider_ref", orderId)
          .maybeSingle();
        if (!payment) return new Response("ok");

        if (event === "payment.failed") {
          await supabaseAdmin
            .from("payments")
            .update({ status: "FAILED" })
            .eq("id", payment.id)
            .eq("status", "PENDING");
          return new Response("ok");
        }

        if (event !== "payment.captured" && event !== "order.paid") return new Response("ok");
        if (payment.status === "SUCCESS") return new Response("ok");

        await supabaseAdmin
          .from("payments")
          .update({ status: "SUCCESS", invoice_number: invoiceNumber() })
          .eq("id", payment.id)
          .eq("status", "PENDING");

        // Activate whatever plan the order was created for.
        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("id, status")
          .eq("business_id", payment.business_id)
          .maybeSingle();
        if (sub && sub.status !== "ACTIVE") {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "ACTIVE",
              provider: "razorpay",
              current_period_end: periodEnd("MONTHLY"),
            })
            .eq("id", sub.id);
        }
        return new Response("ok");
      },
    },
  },
});
