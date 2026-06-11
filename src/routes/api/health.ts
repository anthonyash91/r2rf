import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Render uses this path (configured via healthCheckPath in render.yaml) to
// decide whether a deployment succeeded and to route traffic to the instance.
// The endpoint is exempt from IP allowlist checks in server.ts — Render's probe
// IPs are not on the allowlist and are not known in advance.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Verify DB connectivity with a minimal indexed read.
          // facilities is a small, public-read table — this never blocks real traffic.
          const { error } = await supabaseAdmin
            .from("facilities")
            .select("id")
            .limit(1);
          if (error) {
            console.error("[health] DB check failed:", error.message);
            return new Response(JSON.stringify({ ok: false, error: error.message }), {
              status: 503,
              headers: { "content-type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          console.error("[health] check threw:", err);
          return new Response(JSON.stringify({ ok: false, error: err?.message ?? "unknown" }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
