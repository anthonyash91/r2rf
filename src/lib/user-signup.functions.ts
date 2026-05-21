import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHmac, timingSafeEqual, randomInt } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp } from "./ip-allowlist";
import { SECURITY_QUESTION_KEYS } from "./security-questions";
import { hashAnswer } from "./security-hash.server";


const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const USER_EMAIL_DOMAIN = "users.local";

function syntheticEmailLocal(username: string): string {
  return `${username.toLowerCase()}@${USER_EMAIL_DOMAIN}`;
}

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
        firstName: z.string().trim().min(1, "First name is required").max(100),
        lastName: z.string().trim().min(1, "Last name is required").max(100),
        password: z.string().min(8).max(72),
        facility: z.string().trim().min(1).max(64),
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

    const email = syntheticEmailLocal(data.username);

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
      .insert({
        user_id: userId,
        username: data.username,
        facility: data.facility,
        first_name: data.firstName,
        last_name: data.lastName,
      });
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

    if (data.securityAnswers && data.securityAnswers.length === 2) {
      const securityRows = data.securityAnswers.map((a) => ({
        user_id: userId,
        question_key: a.key,
        answer_hash: hashAnswer(a.value),
      }));
      const { error: secErr } = await supabaseAdmin.from("user_security_answers").insert(securityRows);
      if (secErr) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.from("user_profiles").delete().eq("user_id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(secErr.message);
      }
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
    .select("username, facility, created_at, first_name, last_name")
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  return {
    profile: profile
      ? { ...profile, email: userRes.user.email ?? null }
      : null,
  };
});

