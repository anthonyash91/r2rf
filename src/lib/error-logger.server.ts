import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const MAX_ROUTE = 500;
const MAX_UA = 500;

function clamp(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

// Throttles repeat push notifications for the identical (route, message)
// pair, so a bad deploy causing every request to 500 sends one notification
// instead of one per request — the error is still recorded in error_logs
// every time regardless of this; only the alert itself is throttled.
// In-memory, so it resets on restart and (like the rate limiter — see the
// project memory on dyno scaling) only fully holds on a single dyno; that's
// fine here since under-throttling on multiple dynos just means an
// occasional duplicate notification, not a security gap.
const ALERT_THROTTLE_MS = 15 * 60 * 1000;
const ALERT_THROTTLE_MAX_ENTRIES = 500;
const lastAlertedAt = new Map<string, number>();

async function sendErrorAlert(message: string, route: string | null): Promise<void> {
  const topicUrl = process.env.NTFY_TOPIC_URL;
  if (!topicUrl) return; // Alerting is opt-in — no-op until this is configured.

  const signature = `${route ?? ""}::${message}`;
  const now = Date.now();
  const last = lastAlertedAt.get(signature);
  if (last && now - last < ALERT_THROTTLE_MS) return;
  lastAlertedAt.set(signature, now);
  if (lastAlertedAt.size > ALERT_THROTTLE_MAX_ENTRIES) {
    // Evict the oldest half rather than growing unbounded over a long uptime.
    const oldest = Array.from(lastAlertedAt.entries()).sort((a, b) => a[1] - b[1]);
    for (const [key] of oldest.slice(0, ALERT_THROTTLE_MAX_ENTRIES / 2)) lastAlertedAt.delete(key);
  }

  try {
    const headers: Record<string, string> = {
      Title: "Server error",
      Priority: "high",
      Tags: "rotating_light",
    };
    const appUrl = process.env.APP_BASE_URL;
    if (appUrl) headers.Click = `${appUrl.replace(/\/$/, "")}/admin/errors`;
    await fetch(topicUrl, {
      method: "POST",
      headers,
      body: route ? `${message}\n\nRoute: ${route}` : message,
    });
  } catch (err) {
    // Best-effort — never let a failed notification affect error logging.
    console.error("[error-logger] alert failed:", err);
  }
}

/**
 * Best-effort insert into error_logs, plus a throttled push notification via
 * ntfy.sh when NTFY_TOPIC_URL is configured. Swallows its own failures so
 * caller paths (the branded 500 page, the React error boundary) never crash
 * on a failed log write or notification.
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
    const stack = err instanceof Error ? (err.stack ?? null) : null;
    const clampedMessage = clamp(message || "Unknown error", MAX_MESSAGE) ?? "Unknown error";
    const clampedRoute = clamp(input.route ?? null, MAX_ROUTE);
    await supabaseAdmin.from("error_logs").insert({
      source: "server",
      level: "error",
      message: clampedMessage,
      stack: clamp(stack, MAX_STACK),
      route: clampedRoute,
      ip_address: input.ip ?? null,
      user_agent: clamp(input.userAgent ?? null, MAX_UA),
      user_id: input.userId ?? null,
      context: (input.context ?? {}) as never,
    });
    await sendErrorAlert(clampedMessage, clampedRoute);
  } catch (insertErr) {
    // Logger is best-effort; never throw.
    console.error("[error-logger] insert failed:", insertErr);
  }
}
