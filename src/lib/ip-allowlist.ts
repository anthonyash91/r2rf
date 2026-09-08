/**
 * Picks the non-spoofable entry out of a comma-separated forwarded-IP header,
 * per TRUSTED_IP_XFF_POSITION ("rightmost", the default, or "leftmost").
 *
 * This app is deployed on Heroku, whose router appends its own trustworthy
 * value to the RIGHT of whatever x-forwarded-for it received — including a
 * client-forged one — so the rightmost entry is authoritative and the
 * leftmost is attacker-controlled. Defaulting to "rightmost" matches that
 * reality; only set TRUSTED_IP_XFF_POSITION=leftmost if this is ever deployed
 * behind a host that prepends its own value instead (e.g. Render).
 */
function pickXffEntry(headerValue: string): string | null {
  const parts = headerValue
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const position = process.env.TRUSTED_IP_XFF_POSITION === "leftmost" ? "leftmost" : "rightmost";
  return position === "rightmost" ? parts[parts.length - 1] : parts[0];
}

/**
 * Returns the real client IP from the request.
 *
 * SECURITY — header trust model:
 * Set TRUSTED_IP_HEADER to read a platform-provided single-IP header instead
 * (e.g. a CDN's own "connecting IP" header) when your infrastructure
 * guarantees that header is not client-forgeable. Otherwise this falls back
 * to x-forwarded-for, picked per TRUSTED_IP_XFF_POSITION (see pickXffEntry
 * above) — verify your host's XFF behaviour and set that env var to match
 * before relying on this for access control.
 */
export function getClientIp(request: Request): string | null {
  const trustedHeader = process.env.TRUSTED_IP_HEADER;
  if (trustedHeader) {
    const val = request.headers.get(trustedHeader);
    if (val) return pickXffEntry(val);
  }
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return pickXffEntry(xff);
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}
