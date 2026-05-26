// TEMPORARY one-time endpoint to reveal server secrets so they can be copied
// into another host (e.g. Cloudflare). DELETE THIS FILE as soon as you've
// copied the values you need.
//
// Usage:
//   GET /api/public/_reveal-key?token=lovable-reveal-7f3c91a2
//
// The token below is a shared secret between you and this endpoint. It's
// only meaningful while this file exists — deleting the file invalidates it.

import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

const TOKEN = "lovable-reveal-7f3c91a2";

const SECRET_NAMES = [
  "LOVABLE_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SITE_PASSKEY_HASH",
  "SIGNUP_CHALLENGE_SECRET",
  "BYTESCALE_PUBLIC_API_KEY",
  "BYTESCALE_SECRET_API_KEY",
] as const;

export const Route = createFileRoute("/api/public/reveal-key")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const provided = url.searchParams.get("token") ?? "";
        const a = Buffer.from(provided);
        const b = Buffer.from(TOKEN);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Not found", { status: 404 });
        }

        const result: Record<string, string | null> = {};
        for (const name of SECRET_NAMES) {
          const v = process.env[name];
          result[name] = v ? v : null;
        }
        return Response.json(result, {
          headers: { "Cache-Control": "no-store" },
        });
      },
    },
  },
});
