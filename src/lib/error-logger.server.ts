import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const MAX_ROUTE = 500;
const MAX_UA = 500;

function clamp(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/**
 * Best-effort insert into error_logs. Swallows its own failures so caller
 * paths (the branded 500 page, the React error boundary) never crash on
 * a failed log write.
 */
export async function logServerError(input: {
  error: unknown;
  route?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    const err = input.error;
    const message =
      err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    await supabaseAdmin.from("error_logs").insert({
      source: "server",
      level: "error",
      message: clamp(message || "Unknown error", MAX_MESSAGE) ?? "Unknown error",
      stack: clamp(stack, MAX_STACK),
      route: clamp(input.route ?? null, MAX_ROUTE),
      ip_address: input.ip ?? null,
      user_agent: clamp(input.userAgent ?? null, MAX_UA),
      user_id: input.userId ?? null,
      context: (input.context ?? {}) as never,
    });
  } catch (insertErr) {
    // Logger is best-effort; never throw.
    console.error("[error-logger] insert failed:", insertErr);
  }
}
