import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getClientIp, invalidateAllowlistCache } from "@/lib/ip-allowlist";

// SHA-256 hash of the site passkey. Read from server env so the hash is not
// kept in source. Falls back to a legacy hard-coded hash only if the env var
// is not configured, so the app keeps working during rollout — set
// SITE_PASSKEY_HASH (and rotate the passkey) to fully remove the fallback.
const LEGACY_SITE_PASSKEY_HASH =
  "6c9e159dc6e0cd154e100e11f55b73edb90ab57bef07c73f2865f6fa0ac46ff9";

const MAX_ATTEMPTS = 5;

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

type AttemptRow = {
  id: string;
  ip_address: string;
  failed_count: number;
  blocked_at: string | null;
};

async function fetchAttempt(
  url: string,
  key: string,
  ip: string,
): Promise<AttemptRow | null> {
  const res = await fetch(
    `${url}/rest/v1/ip_passkey_attempts?ip_address=eq.${encodeURIComponent(ip)}&select=id,ip_address,failed_count,blocked_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as AttemptRow[];
  return rows[0] ?? null;
}

async function upsertAttempt(
  url: string,
  key: string,
  ip: string,
  failedCount: number,
  block: boolean,
): Promise<void> {
  const body = {
    ip_address: ip,
    failed_count: failedCount,
    last_attempt_at: new Date().toISOString(),
    ...(block ? { blocked_at: new Date().toISOString() } : {}),
  };
  const res = await fetch(`${url}/rest/v1/ip_passkey_attempts?on_conflict=ip_address`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[site-passkey] attempt upsert failed:", res.status, await res.text());
  }
}

export const Route = createFileRoute("/api/public/site-passkey")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request);
        if (!ip) {
          return Response.json({ error: "Could not determine IP" }, { status: 400 });
        }

        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
          return Response.json({ error: "Server misconfigured" }, { status: 500 });
        }

        // If this IP is already blocked, short-circuit immediately.
        const existing = await fetchAttempt(url, key, ip);
        if (existing?.blocked_at) {
          return Response.json({ error: "Permanently blocked", blocked: true }, { status: 403 });
        }

        let parsed: { passkey: string; label: string };
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }

        const hash = await sha256Hex(parsed.passkey.trim());
        const expectedHash = (process.env.SITE_PASSKEY_HASH ?? LEGACY_SITE_PASSKEY_HASH).trim().toLowerCase();
        const ok = timingSafeEqualHex(hash, expectedHash);

        if (!ok) {
          const nextCount = (existing?.failed_count ?? 0) + 1;
          const shouldBlock = nextCount >= MAX_ATTEMPTS;
          await upsertAttempt(url, key, ip, nextCount, shouldBlock);
          invalidateAllowlistCache();
          if (shouldBlock) {
            return Response.json(
              { error: "Permanently blocked", blocked: true },
              { status: 403 },
            );
          }
          return Response.json(
            { error: "Incorrect passkey", remaining: MAX_ATTEMPTS - nextCount },
            { status: 401 },
          );
        }

        // Successful unlock — clear any prior failed attempts and add to allowlist.
        if (existing) {
          await fetch(
            `${url}/rest/v1/ip_passkey_attempts?ip_address=eq.${encodeURIComponent(ip)}`,
            {
              method: "DELETE",
              headers: { apikey: key, Authorization: `Bearer ${key}` },
            },
          );
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
