import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHmac, timingSafeEqual, randomInt } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SECURITY_QUESTION_KEYS } from "./security-questions";
import { hashAnswer, hashPin, verifyPin } from "./security-hash.server";
import { getClientIp } from "./ip-allowlist";

const SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000;
const SIGNUP_MAX_PER_IP = 5;

// In-process rate limiter for checkInmatePin: 20 checks per minute per IP.
// Prevents automated PIN-availability scanning without impacting normal signup flow.
const PIN_CHECK_WINDOW_MS = 60_000;
const PIN_CHECK_MAX_PER_IP = 20;
type IpBucket = { count: number; windowStart: number };
const pinCheckBuckets = new Map<string, IpBucket>();

function isPinCheckRateLimited(ip: string): boolean {
  const now = Date.now();
  let bucket = pinCheckBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > PIN_CHECK_WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    pinCheckBuckets.set(ip, bucket);
  }
  if (bucket.count >= PIN_CHECK_MAX_PER_IP) return true;
  bucket.count++;
  return false;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const USER_EMAIL_DOMAIN = "users.local";


function syntheticEmailLocal(username: string): string {
  return `${username.toLowerCase()}@${USER_EMAIL_DOMAIN}`;
}

function getSecret(): string {
  const secret = process.env.SIGNUP_CHALLENGE_SECRET;
  if (secret && secret.length >= 32) return secret;
  throw new Error(
    "Server misconfiguration: SIGNUP_CHALLENGE_SECRET must be set (min 32 chars). " +
    "Generate one with: openssl rand -hex 32"
  );
}

// HMAC-signed challenge token: encodes `a:b:expiresAt` + a SHA-256 HMAC
// so the server can verify the token was issued by us and hasn't expired.
// base64url encoding makes it safe to include in form fields.
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
    // Reject expired tokens — CHALLENGE_TTL_MS = 5 minutes from issue time.
    if (Date.now() > exp) return false;
    const expected = createHmac("sha256", getSecret()).update(`${a}:${b}:${exp}`).digest("hex");
    // timingSafeEqual prevents timing attacks that could recover the HMAC secret.
    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expBuf.length) return false;
    if (!timingSafeEqual(sigBuf, expBuf)) return false;
    return a + b === answer;
  } catch {
    return false;
  }
}




export const getSignupChallenge = createServerFn({ method: "GET" }).handler(async () => {
  // Rate-limit challenge generation using an advisory-lock RPC so concurrent
  // requests from the same IP cannot race past the limit (fixes check-then-insert race).
  const ip = getClientIp(getRequest());
  if (ip) {
    const since = new Date(Date.now() - 60_000).toISOString();
    const { error } = await (supabaseAdmin as any).rpc(
      "check_and_record_signup_challenge_attempt",
      { p_ip: ip, p_since: since, p_max: 10 },
    );
    if (error) {
      if (error.message.includes("rate_limited")) {
        throw new Error("Too many requests. Please wait a moment before trying again.");
      }
      throw new Error(error.message);
    }
  }
  const a = randomInt(1, 100);
  const b = randomInt(1, 100);
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;
  return { a, b, token: signChallenge(a, b, expiresAt) };
});

/** Checks whether an inmate PIN is already registered for a given facility. */
export const checkInmatePin = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      facilityValue: z.string().min(1).max(64),
      inmatePin: z.string().min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const ip = getClientIp(getRequest());
    if (ip && isPinCheckRateLimited(ip)) {
      throw new Error("Too many requests. Please wait a moment before trying again.");
    }
    const pinHmac = hashPin(data.inmatePin);
    const { data: byHmac } = await supabaseAdmin
      .from("user_profiles" as any)
      .select("user_id")
      .eq("facility", data.facilityValue)
      .eq("inmate_pin_hmac", pinHmac)
      .maybeSingle();
    return { available: !byHmac };
  });

export const signupUser = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/, "Username must be 3–32 chars, letters/numbers/underscore"),
        firstName: z.string().trim().min(1, "First name is required").max(100),
        lastName: z.string().trim().min(1, "Last name is required").max(100),
        password: z.string().min(8).max(72),
        facility: z.string().trim().min(1).max(64),
        inmatePin: z.string().regex(/^\d+$/, "Inmate PIN must be numbers only"),
        challengeToken: z.string().min(1).max(500),
        challengeAnswer: z.coerce.number().int(),
        honeypot: z.string().max(0).optional().default(""),
        securityAnswers: z
          .array(
            z.object({
              key: z.string().refine((v) => (SECURITY_QUESTION_KEYS as readonly string[]).includes(v), "Invalid question"),
              value: z.string().trim().min(2).max(200),
            }),
          )
          .length(2)
          .refine((arr) => arr[0].key !== arr[1].key, "Choose two different questions")
          .optional(),
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

    // IP-based rate limiting is intentionally omitted here. All inmates at a
    // facility share the same external IP (facility NAT), so a per-IP limit
    // would block an entire facility after a handful of sign-ups. The inmate
    // PIN requirement is the real gate — each PIN can only register one account.

    // Validate facility exists
    const { data: facilityRow } = await supabaseAdmin
      .from("facilities")
      .select("value")
      .eq("value", data.facility)
      .maybeSingle();
    if (!facilityRow) throw new Error("Invalid facility. Please select a valid facility.");

    // Username availability
    const { data: exists } = await supabaseAdmin.rpc("username_exists", { _username: data.username });
    if (exists) throw new Error("That username is already taken.");

    // Server-side PIN uniqueness check — guards the race condition where two
    // concurrent submissions with the same PIN both pass the client preflight.
    if (data.inmatePin) {
      const pinHmac = hashPin(data.inmatePin);
      const { data: byHmac } = await supabaseAdmin
        .from("user_profiles" as any).select("user_id")
        .eq("facility", data.facility).eq("inmate_pin_hmac", pinHmac).maybeSingle();
      if (byHmac) throw new Error("That PIN is already registered at this facility.");
    }

    const email = syntheticEmailLocal(data.username);

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, facility: data.facility },
    });
    if (createErr || !created?.user) {
      console.error("[signup] createUser failed:", createErr?.message);
      throw new Error("Account creation failed. Please try again.");
    }
    const userId = created.user.id;

    const { error: profErr } = await supabaseAdmin
      .from("user_profiles" as any)
      .insert({
        user_id: userId,
        username: data.username,
        facility: data.facility,
        first_name: data.firstName,
        last_name: data.lastName,
        email,
        inmate_pin_hmac: data.inmatePin ? hashPin(data.inmatePin) : null,
      });
    if (profErr) {
      console.error("[signup] user_profiles insert failed:", profErr.message);
      // Roll back the auth user so the username + PIN can be retried.
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Account creation failed. Please try again.");
    }

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "user" });
    if (roleErr) {
      console.error("[signup] user_roles insert failed:", roleErr.message);
      // Roll back profile + auth user on each failure so no orphaned records remain.
      await supabaseAdmin.from("user_profiles").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Account creation failed. Please try again.");
    }

    if (data.securityAnswers && data.securityAnswers.length === 2) {
      const securityRows = data.securityAnswers.map((a) => ({
        user_id: userId,
        question_key: a.key,
        answer_hash: hashAnswer(a.value),
      }));
      const { error: secErr } = await supabaseAdmin.from("user_security_answers").insert(securityRows);
      if (secErr) {
        console.error("[signup] user_security_answers insert failed:", secErr.message);
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("user_profiles").delete().eq("user_id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error("Account creation failed. Please try again.");
      }
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
    .select("username, facility, created_at, first_name, last_name")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  return {
    profile: profile
      ? { ...profile, email: userRes.user.email ?? null }
      : null,
  };
});


export const getMyFacilityValue = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { facility: null as string | null, slug: null as string | null };
  const token = auth.slice("Bearer ".length);
  const { data: userRes } = await supabaseAdmin.auth.getUser(token);
  if (!userRes?.user) return { facility: null, slug: null };
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("facility")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  const facilityValue = (profile?.facility as string | undefined) ?? null;
  if (!facilityValue) return { facility: null, slug: null };
  // Resolve the site_id for this facility — that is the URL slug
  const { data: facilityRow } = await supabaseAdmin
    .from("facilities")
    .select("site_id")
    .eq("value", facilityValue)
    .maybeSingle();
  const slug = ((facilityRow as any)?.site_id ?? null) as string | null;
  return { facility: facilityValue, slug };
});


export const saveFacilityMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      facilityValue: z.string().min(1).max(64),
      value: z.object({
        enabled: z.boolean(),
        message: z.string(),
        message_es: z.string(),
      }),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    // Allow admin or facilityUser writing their own facility key.
    // Use select (not maybeSingle) — tester accounts have both roles simultaneously.
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "facilityUser"]);
    // Prefer admin so testers (who hold both) are treated as admin.
    const roleRow = roleRows?.find((r) => r.role === "admin") ?? roleRows?.[0] ?? null;
    if (!roleRow) throw new Error("Forbidden");

    // facilityUser: verify the key matches their own facility
    if (roleRow.role === "facilityUser") {
      const { data: prof } = await supabaseAdmin
        .from("user_profiles")
        .select("facility")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!prof || prof.facility !== data.facilityValue) {
        throw new Error("Forbidden: can only edit your own facility's message");
      }
    }

    const key = `facility_message_${data.facilityValue}`;
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key, value: data.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
