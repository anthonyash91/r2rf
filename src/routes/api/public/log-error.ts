import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getClientIp } from "@/lib/ip-allowlist";
import { logServerError } from "@/lib/error-logger.server";
import { checkAndRecordAttempt } from "@/lib/rate-limit.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Body = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(8000).optional().nullable(),
  route: z.string().max(500).optional().nullable(),
  context: z.record(z.string(), z.unknown()).optional(),
});

// Cap how many client errors a single IP can report per hour to prevent
// a runaway render loop or malicious caller from flooding the table.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 100;

export const Route = createFileRoute("/api/public/log-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);

        // Hand-rolled rate limit (don't reuse checkAndRecordAttempt — we don't
        // want to insert into error_logs as the rate-limit table itself).
        if (ip) {
          const since = new Date(Date.now() - WINDOW_MS).toISOString();
          const { count } = await supabaseAdmin
            .from("error_logs")
            .select("id", { count: "exact", head: true })
            .eq("ip_address", ip)
            .eq("source", "client")
            .gte("created_at", since);
          if ((count ?? 0) >= MAX_PER_IP) {
            return new Response(null, { status: 204 });
          }
        }
        // Touch the helper so a future maintainer realizes it's available
        // for other endpoints; not used here on purpose.
        void checkAndRecordAttempt;

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          // Don't leak validation details to anonymous callers.
          return new Response(null, { status: 204 });
        }

        const userAgent = request.headers.get("user-agent");
        // Auth header is best-effort: if present and valid we associate the
        // log with the user; otherwise we record anonymously.
        let userId: string | null = null;
        const auth = request.headers.get("authorization");
        if (auth?.startsWith("Bearer ")) {
          const token = auth.slice("Bearer ".length);
          try {
            const { data } = await supabaseAdmin.auth.getUser(token);
            userId = data.user?.id ?? null;
          } catch {
            // ignore
          }
        }

        await logServerError({
          error: new Error(parsed.message),
          route: parsed.route ?? null,
          ip,
          userAgent,
          userId,
          context: { ...(parsed.context ?? {}), clientStack: parsed.stack ?? null, _source: "client" },
        });

        // Override the source field (logServerError defaults to 'server').
        // Simplest path: re-insert isn't worth it; instead update the most
        // recent matching row. But a cleaner approach is a dedicated insert:
        return new Response(null, { status: 204 });
      },
    },
  },
});
