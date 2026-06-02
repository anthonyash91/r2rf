import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AttemptsTable = "signup_attempts" | "password_reset_attempts";

/**
 * Generic IP-based rate limiter backed by an attempts table.
 *
 * Counts rows for this IP within the window; if at or above `max`, throws.
 * Otherwise records a new attempt row. The table must have `ip_address` (text)
 * and `created_at` (timestamptz) columns, plus any additional columns passed
 * via `extraColumns`.
 *
 * Designed for endpoints where we want a hard cap on requests per IP per
 * window — signup, password reset, etc. No-op if IP can't be determined
 * (caller should still validate input).
 */
export async function checkAndRecordAttempt(opts: {
  table: AttemptsTable;
  ip: string | null;
  windowMs: number;
  max: number;
  extraColumns?: Record<string, unknown>;
  errorMessage?: string;
}): Promise<void> {
  const { table, ip, windowMs, max, extraColumns, errorMessage } = opts;
  if (!ip) return;

  const since = new Date(Date.now() - windowMs).toISOString();
  const { count } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", since);

  if ((count ?? 0) >= max) {
    throw new Error(errorMessage ?? "Too many requests. Please try again later.");
  }

  await (supabaseAdmin as any).from(table).insert({ ip_address: ip, ...(extraColumns ?? {}) });
}
