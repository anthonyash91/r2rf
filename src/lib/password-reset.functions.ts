import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp } from "./ip-allowlist";
import { SECURITY_QUESTION_KEYS } from "./security-questions";
import { hashAnswer, verifyAnswer, verifyPin } from "./security-hash.server";


const USER_EMAIL_DOMAIN = "users.local";
const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_MAX_PER_IP = 8;
const QUESTION_PROBE_MAX_PER_IP = 30;


function syntheticEmailLocal(username: string): string {
  return `${username.toLowerCase()}@${USER_EMAIL_DOMAIN}`;
}

const answersSchema = z
  .array(
    z.object({
      key: z.string().refine((v) => (SECURITY_QUESTION_KEYS as readonly string[]).includes(v), "Invalid question"),
      value: z.string().trim().min(2).max(200),
    }),
  )
  .length(2)
  .refine((arr) => arr[0].key !== arr[1].key, "Choose two different questions");

async function findUserIdByUsername(username: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_profiles")
    .select("user_id")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data?.user_id ?? null;
}

async function checkAndRecordResetAttempt(ip: string | null, username: string) {
  if (!ip) return; // No IP available — skip rate limiting rather than blocking everyone
  const since = new Date(Date.now() - RESET_WINDOW_MS).toISOString();
  // The DB function uses an advisory lock so concurrent requests can't race
  // past the rate limit by reading the count before either has inserted.
  const { error } = await supabaseAdmin.rpc("check_and_record_reset_attempt" as any, {
    p_ip: ip,
    p_username: username.toLowerCase(),
    p_since: since,
    p_max: RESET_MAX_PER_IP,
  });
  if (error) {
    if (error.message.includes("rate_limited")) {
      throw new Error("Too many reset attempts. Please try again later.");
    }
    throw new Error(error.message);
  }
}

/**
 * Returns the user's two security-question keys. To avoid username enumeration,
 * if no such user exists we deterministically return two stable bank keys so
 * the request looks the same. The subsequent reset call will still fail.
 */
export const getResetQuestions = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/),
      inmatePin: z.string().optional(),
      facilityValue: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    // Rate-limit username probing per IP using an advisory-lock RPC so concurrent
    // requests from the same IP cannot race past the limit (fixes check-then-insert race).
    const ip = getClientIp(getRequest());
    if (ip) {
      const since = new Date(Date.now() - RESET_WINDOW_MS).toISOString();
      const { error: probeErr } = await supabaseAdmin.rpc(
        "check_and_record_question_probe" as any,
        { p_ip: ip, p_since: since, p_max: QUESTION_PROBE_MAX_PER_IP },
      );
      if (probeErr) {
        if (probeErr.message.includes("rate_limited")) {
          throw new Error("Too many requests. Please try again later.");
        }
        throw new Error(probeErr.message);
      }
    }
    const userId = await findUserIdByUsername(data.username);

    // Deterministically derive two distinct fake question keys from the username.
    // Using SHA-256 ensures the same username always returns the same pair,
    // so timing/response analysis can't distinguish "user exists" from "user not found".
    const fakePair = (username: string) => {
      const hash = createHash("sha256").update(username).digest();
      const a = SECURITY_QUESTION_KEYS[hash[0] % SECURITY_QUESTION_KEYS.length];
      let b = SECURITY_QUESTION_KEYS[hash[1] % SECURITY_QUESTION_KEYS.length];
      if (b === a) b = SECURITY_QUESTION_KEYS[(hash[1] + 1) % SECURITY_QUESTION_KEYS.length];
      return { keys: [a, b] as string[] };
    };

    if (!userId) return fakePair(data.username);

    // If PIN + facility were provided (shared-tablet flow), verify they match
    // the account before returning real questions. Always use the same generic
    // fake response on mismatch so nothing is leaked.
    if (data.inmatePin) {
      const { data: profile } = await (supabaseAdmin as any)
        .from("user_profiles")
        .select("inmate_pin, inmate_pin_hmac, facility")
        .eq("user_id", userId)
        .maybeSingle();
      // Prefer HMAC comparison (timing-safe). Fall back to plaintext === during
      // the migration window when the HMAC column hasn't been populated yet.
      const pinMatch = profile?.inmate_pin_hmac
        ? verifyPin(data.inmatePin, profile.inmate_pin_hmac)
        : profile?.inmate_pin === data.inmatePin;
      const facilityMatch = !data.facilityValue || profile?.facility === data.facilityValue;
      if (!pinMatch || !facilityMatch) return fakePair(data.username);
    }
    const { data: rows } = await supabaseAdmin
      .from("user_security_answers")
      .select("question_key")
      .eq("user_id", userId);
    const keys = (rows ?? []).map((r) => r.question_key).slice(0, 2);
    if (keys.length < 2) return fakePair(data.username);
    return { keys };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/),
        answers: answersSchema,
        newPassword: z.string().min(8).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ip = getClientIp(getRequest());
    await checkAndRecordResetAttempt(ip, data.username);

    // A single generic error for all failure modes (wrong user, wrong answers)
    // prevents an attacker from knowing whether the username exists.
    const genericError = "Username or security answers are incorrect.";
    const userId = await findUserIdByUsername(data.username);
    if (!userId) throw new Error(genericError);

    const { data: rows } = await supabaseAdmin
      .from("user_security_answers")
      .select("question_key, answer_hash")
      .eq("user_id", userId);
    if (!rows || rows.length < 2) throw new Error(genericError);

    const byKey = new Map(rows.map((r) => [r.question_key, r.answer_hash]));
    for (const a of data.answers) {
      const stored = byKey.get(a.key);
      if (!stored || !verifyAnswer(a.value, stored)) {
        throw new Error(genericError);
      }
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.newPassword,
    });
    if (updErr) {
      console.error("[password-reset] updateUserById failed:", updErr.message);
      throw new Error("Unable to reset password. Please try again.");
    }

    return { ok: true as const, email: syntheticEmailLocal(data.username) };
  });

export const getMySecurityQuestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await supabaseAdmin
      .from("user_security_answers")
      .select("question_key")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    return { keys: (rows ?? []).map((r) => r.question_key) };
  });

export const updateSecurityAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ answers: answersSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const newKeys = data.answers.map((a) => a.key);
    const rows = data.answers.map((a) => ({
      user_id: userId,
      question_key: a.key,
      answer_hash: hashAnswer(a.value),
    }));

    // Insert new answers first. If this fails the user retains their existing
    // answers — no lockout risk. Only delete old answers after the insert succeeds.
    const { error: insErr } = await supabaseAdmin
      .from("user_security_answers")
      .insert(rows);
    if (insErr) throw new Error(insErr.message);

    // Remove any rows whose question_key is NOT among the newly inserted keys
    // (i.e. the previous answers that are being replaced).
    await supabaseAdmin
      .from("user_security_answers")
      .delete()
      .eq("user_id", userId)
      .not("question_key", "in", `(${newKeys.join(",")})`);

    return { ok: true as const };
  });

