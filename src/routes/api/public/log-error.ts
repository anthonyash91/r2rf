import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getClientIp } from "@/lib/ip-allowlist";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Body = z.object({
  message: z.string().trim().min(1).max(2000),
  stack: z.string().max(8000).optional().nullable(),
  route: z.string().max(500).optional().nullable(),
  context: z.record(z.string(), z.unknown()).optional(),
});

// In-process rate limiter: 100 error reports per IP per hour.
// Replaces the previous DB COUNT query which fired a DB round-trip on every
// incoming error report — defeating the purpose of rate limiting by amplifying
// the load it was trying to prevent.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_IP = 100;
type IpBucket = { count: number; windowStart: number };
const ipBuckets = new Map<string, IpBucket>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  let bucket = ipBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    ipBuckets.set(ip, bucket);
  }
  if (bucket.count >= MAX_PER_IP) return true;
  bucket.count++;
  return false;
}

export const Route = createFileRoute("/api/public/log-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);

        if (ip && isRateLimited(ip)) {
          // Silently drop (still 204) rather than 429 — returning 429 would
          // reveal that rate limiting is active, potentially aiding enumeration.
          return new Response(null, { status: 204 });
        }

        let parsed: z.infer<typeof Body>;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          // Don't leak validation details to anonymous callers.
          return new Response(null, { status: 204 });
        }

        // Attribute to a user if the request includes a valid bearer token;
        // missing or invalid tokens are silently ignored — this is a public endpoint.
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

        try {
          await supabaseAdmin.from("error_logs").insert({
            source: "client",
            level: "error",
            message: parsed.message,
            stack: parsed.stack ?? null,
            route: parsed.route ?? null,
            ip_address: ip,
            user_agent: request.headers.get("user-agent"),
            user_id: userId,
            context: (parsed.context ?? {}) as never,
          });
        } catch (err) {
          console.error("[log-error] insert failed:", err);
        }

        // Always respond 204 regardless of insert success — this is a fire-and-
        // forget endpoint; callers must not branch on the response status.
        return new Response(null, { status: 204 });
      },
    },
  },
});
