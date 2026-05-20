import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { timingSafeEqual, randomBytes, createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp } from "./ip-allowlist";
import { SECURITY_QUESTION_KEYS, normalizeAnswer } from "./security-questions";

const USER_EMAIL_DOMAIN = "users.local";
const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_MAX_PER_IP = 8;

function syntheticEmailLocal(username: string): string {
  return `${username.toLowerCase()}@${USER_EMAIL_DOMAIN}`;
}

// Hash format: sha256$<saltHex>$<hashHex>
export function hashAnswer(answer: string): string {
  const salt = randomBytes(16).toString("hex");
  const norm = normalizeAnswer(answer);
  const hash = createHash("sha256").update(`${salt}:${norm}`).digest("hex");
  return `sha256$${salt}$${hash}`;
}

function verifyAnswer(answer: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "sha256") return false;
    const [, salt, expected] = parts;
    const norm = normalizeAnswer(answer);
    const got = createHash("sha256").update(`${salt}:${norm}`).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(got, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
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
  if (!ip) return;
  const since = new Date(Date.now() - RESET_WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from("password_reset_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", since);
  if ((count ?? 0) >= RESET_MAX_PER_IP) {
    throw new Error("Too many reset attempts. Please try again later.");
  }
  await supabaseAdmin.from("password_reset_attempts").insert({ ip_address: ip, username: username.toLowerCase() });
}

/**
 * Returns the user's two security-question keys. To avoid username enumeration,
 * if no such user exists we deterministically return two stable bank keys so
 * the request looks the same. The subsequent reset call will still fail.
 */
export const getResetQuestions = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await findUserIdByUsername(data.username);
    if (!userId) {
      // stable fake pair derived from username
      const hash = createHash("sha256").update(data.username).digest();
      const a = SECURITY_QUESTION_KEYS[hash[0] % SECURITY_QUESTION_KEYS.length];
      let b = SECURITY_QUESTION_KEYS[hash[1] % SECURITY_QUESTION_KEYS.length];
      if (b === a) b = SECURITY_QUESTION_KEYS[(hash[1] + 1) % SECURITY_QUESTION_KEYS.length];
      return { keys: [a, b] as string[] };
    }
    const { data: rows } = await supabaseAdmin
      .from("user_security_answers")
      .select("question_key")
      .eq("user_id", userId);
    const keys = (rows ?? []).map((r) => r.question_key).slice(0, 2);
    if (keys.length < 2) {
      // user hasn't configured questions yet — return stable fake pair
      const hash = createHash("sha256").update(data.username).digest();
      const a = SECURITY_QUESTION_KEYS[hash[0] % SECURITY_QUESTION_KEYS.length];
      let b = SECURITY_QUESTION_KEYS[hash[1] % SECURITY_QUESTION_KEYS.length];
      if (b === a) b = SECURITY_QUESTION_KEYS[(hash[1] + 1) % SECURITY_QUESTION_KEYS.length];
      return { keys: [a, b] as string[] };
    }
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
    if (updErr) throw new Error(updErr.message);

    return { ok: true as const, email: syntheticEmailLocal(data.username) };
  });

export const getMySecurityQuestions = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { keys: [] as string[] };
  const token = auth.slice("Bearer ".length);
  const { data: userRes } = await supabaseAdmin.auth.getUser(token);
  if (!userRes?.user) return { keys: [] as string[] };
  const { data: rows } = await supabaseAdmin
    .from("user_security_answers")
    .select("question_key")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true });
  return { keys: (rows ?? []).map((r) => r.question_key) };
});

export const updateSecurityAnswers = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ answers: answersSchema }).parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Not signed in.");
    const token = auth.slice("Bearer ".length);
    const { data: userRes } = await supabaseAdmin.auth.getUser(token);
    if (!userRes?.user) throw new Error("Not signed in.");
    const userId = userRes.user.id;

    await supabaseAdmin.from("user_security_answers").delete().eq("user_id", userId);
    const rows = data.answers.map((a) => ({
      user_id: userId,
      question_key: a.key,
      answer_hash: hashAnswer(a.value),
    }));
    const { error } = await supabaseAdmin.from("user_security_answers").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
