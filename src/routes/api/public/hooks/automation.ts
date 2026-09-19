import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled automation runner (birthday / anniversary / win-back / expiring rewards).
 * Called by the database scheduler with a shared bearer secret.
 */
export const Route = createFileRoute("/api/public/hooks/automation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const provided = (request.headers.get("authorization") ?? "").replace("Bearer ", "");
        if (provided !== secret) return new Response("Unauthorized", { status: 401 });

        const { runAutomation } = await import("@/lib/automation.server");
        try {
          const summary = await runAutomation();
          return new Response(JSON.stringify({ ok: true, ...summary }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ ok: false }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
