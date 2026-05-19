import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getClientIp, invalidateAllowlistCache } from "@/lib/ip-allowlist";

// SHA-256 hash of the site passkey. The plaintext is delivered to the
// admin out-of-band — only this hash is stored in the codebase.
const SITE_PASSKEY_HASH =
  "6c9e159dc6e0cd154e100e11f55b73edb90ab57bef07c73f2865f6fa0ac46ff9";

const Body = z.object({
  passkey: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(80),
});

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/site-passkey")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);
        if (!ip) {
          return Response.json({ error: "Could not determine IP" }, { status: 400 });
        }

        let parsed: { passkey: string; label: string };
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const hash = await sha256Hex(parsed.passkey.trim());
        if (!timingSafeEqualHex(hash, SITE_PASSKEY_HASH)) {
          return Response.json({ error: "Incorrect passkey" }, { status: 401 });
        }

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
          return Response.json({ error: "Server misconfigured" }, { status: 500 });
        }

        const res = await fetch(`${url}/rest/v1/ip_allowlist`, {
          method: "POST",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({ ip_address: ip, label: parsed.label }),
        });
        if (!res.ok && res.status !== 409) {
          const txt = await res.text();
          console.error("[site-passkey] insert failed:", res.status, txt);
          return Response.json({ error: "Failed to add IP" }, { status: 500 });
        }

        invalidateAllowlistCache();
        return Response.json(
          { ok: true, ip },
          {
            headers: {
              // Grant immediate access on the reload following a successful
              // unlock. Short-lived: the IP is now persisted in the allowlist
              // and will be picked up by the normal check after caches refresh.
              "Set-Cookie": "site_passkey_ok=1; Path=/; Max-Age=300; SameSite=Lax; Secure; HttpOnly",
            },
          },
        );
      },
    },
  },
});
