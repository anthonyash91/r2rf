export type DateRange = "7d" | "30d" | "90d" | "all" | "month";

/**
 * Returns an ISO timestamp representing the start of the given date range,
 * or null for "all" (no lower bound). Used to filter analytics queries.
 *
 * Note: "month" = calendar month start (midnight on the 1st).
 *       "30d"   = rolling 30 days from now.
 * These are intentionally different — "month" resets on the 1st while
 * "30d" always looks back exactly 30 days.
 */
export function sinceIsoFor(range: DateRange): string | null {
  if (range === "month") {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : null;
  if (days === null) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Formats a duration in seconds as a human-readable time breakdown.
 * Rounds up to the nearest second and shows all non-zero components.
 * Examples: "45 sec" | "3 min 12 sec" | "1 hr 23 min 45 sec"
 */
export function formatTimeSpent(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  if (s <= 0) return "0 min";
  if (s < 60) return "< 1 min";
  const days    = Math.floor(s / 86400);
  const hours   = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (days > 0)    parts.push(`${days}d`);
  if (hours > 0)   parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(" ") || "< 1 min";
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateShort(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "2-digit", month: "2-digit", day: "2-digit" });
}
