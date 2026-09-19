import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled automation runner (birthday / anniversary / win-back / expiring rewards).
 * Called by the database scheduler with a shared bearer secret.
 */
export const Route = createFileRoute("/api/public/hooks/automation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const accepted = [
          process.env["AUTOMATION_CRON_TOKEN"],
          process.env["AUTOMATION_CRON_SECRET"],
          process.env["LOVABLE_CRON_SECRET"],
        ].filter((v): v is string => typeof v === "string" && v.length > 0);
        if (accepted.length === 0) return new Response("Not configured", { status: 503 });

        const provided = (request.headers.get("authorization") ?? "").replace("Bearer ", "");
        if (!accepted.includes(provided)) return new Response("Unauthorized", { status: 401 });


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
