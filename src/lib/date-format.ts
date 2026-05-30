/**
 * Formats a duration in seconds as a human-readable time breakdown.
 * Rounds up to the nearest second and shows all non-zero components.
 * Examples: "45 sec" | "3 min 12 sec" | "1 hr 23 min 45 sec"
 */
export function formatTimeSpent(totalSeconds: number): string {
  const s = Math.ceil(totalSeconds);
  if (s <= 0) return "0 sec";
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} hr`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} sec`);
  return parts.join(" ");
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
