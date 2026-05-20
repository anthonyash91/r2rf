import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHmac, timingSafeEqual, randomInt } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp } from "./ip-allowlist";

const FACILITIES = ["pennington_sd", "campbell_ky"] as const;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const USER_EMAIL_DOMAIN = "users.local";

function syntheticEmailLocal(username: string): string {
  return `${username.toLowerCase()}@${USER_EMAIL_DOMAIN}`;
}
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

function getSecret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_URL || "fallback-signup-secret";
  return s;
}

function signChallenge(a: number, b: number, expiresAt: number): string {
  const payload = `${a}:${b}:${expiresAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyChallenge(token: string, answer: number): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return false;
    const [aStr, bStr, expStr, sig] = parts;
    const a = Number(aStr), b = Number(bStr), exp = Number(expStr);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(exp)) return false;
    if (Date.now() > exp) return false;
    const expected = createHmac("sha256", getSecret()).update(`${a}:${b}:${exp}`).digest("hex");
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    if (!timingSafeEqual(sigBuf, expBuf)) return false;
    return a + b === answer;
  } catch {
    return false;
  }
}

export function syntheticEmail(username: string): string {
  return `${username.toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export const getSignupChallenge = createServerFn({ method: "GET" }).handler(async () => {
  const a = randomInt(1, 10);
  const b = randomInt(1, 10);
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  return { a, b, token: signChallenge(a, b, expiresAt) };
});

export const signupUser = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/, "Username must be 3–32 chars, letters/numbers/underscore"),
        password: z.string().min(8).max(72),
        facility: z.enum(FACILITIES),
        challengeToken: z.string().min(1).max(500),
        challengeAnswer: z.coerce.number().int(),
        honeypot: z.string().max(0).optional().default(""),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (data.honeypot && data.honeypot.length > 0) {
      throw new Error("Invalid submission.");
    }
    if (!verifyChallenge(data.challengeToken, data.challengeAnswer)) {
      throw new Error("Captcha failed. Please try again.");
    }

    const ip = getClientIp(getRequest());

    // Rate limit by IP using user_signup_ips
    if (ip) {
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      const { count } = await supabaseAdmin
        .from("user_signup_ips")
        .select("user_id", { count: "exact", head: true })
        .eq("ip_address", ip)
        .gte("created_at", since);
      if ((count ?? 0) >= RATE_LIMIT_MAX) {
        throw new Error("Too many signups from your network. Please try again later.");
      }
    }

    // Username availability
    const { data: exists } = await supabaseAdmin.rpc("username_exists", { _username: data.username });
    if (exists) throw new Error("That username is already taken.");

    const email = syntheticEmail(data.username);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, facility: data.facility },
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Failed to create account.");
    }
    const userId = created.user.id;

    const { error: profErr } = await supabaseAdmin
      .from("user_profiles")
      .insert({ user_id: userId, username: data.username, facility: data.facility });
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(profErr.message);
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "user" });
    if (roleErr) {
      await supabaseAdmin.from("user_profiles").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(roleErr.message);
    }

    if (ip) {
      await supabaseAdmin
        .from("user_signup_ips")
        .upsert({ user_id: userId, ip_address: ip }, { onConflict: "user_id", ignoreDuplicates: true });
    }

    return { ok: true as const, email };
  });

export const getMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  // Read auth from header manually since this is public-callable
  const request = getRequest();
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { profile: null };
  const token = auth.slice("Bearer ".length);
  const { data: userRes } = await supabaseAdmin.auth.getUser(token);
  if (!userRes?.user) return { profile: null };
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("username, facility, created_at")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  return {
    profile: profile
      ? { ...profile, email: userRes.user.email ?? null }
      : null,
  };
});

export const FACILITY_OPTIONS: { value: typeof FACILITIES[number]; label: string }[] = [
  { value: "pennington_sd", label: "Pennington, SD" },
  { value: "campbell_ky", label: "Campbell, KY" },
];

export function facilityLabel(value: string | null | undefined): string {
  return FACILITY_OPTIONS.find((f) => f.value === value)?.label ?? (value ?? "");
}
