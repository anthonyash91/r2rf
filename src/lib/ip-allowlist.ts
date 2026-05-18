// Module-scoped cache for the IP allowlist. Refreshed periodically to keep
// the firewall responsive when admins add or remove IPs.
const CACHE_TTL_MS = 30_000;

let cache: { ips: Set<string>; expiresAt: number } | null = null;
let inflight: Promise<Set<string>> | null = null;

async function fetchAllowlist(): Promise<Set<string>> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[ip-allowlist] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return new Set(["74.138.97.209"]);
  }
  const res = await fetch(`${url}/rest/v1/ip_allowlist?select=ip_address`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    console.error("[ip-allowlist] Fetch failed:", res.status, await res.text());
    return new Set(["74.138.97.209"]);
  }
  const rows = (await res.json()) as Array<{ ip_address: string }>;
  const ips = new Set(rows.map((r) => r.ip_address.trim()));
  ips.add("74.138.97.209");
  return ips;
}

export async function getAllowedIps(): Promise<Set<string>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.ips;
  if (inflight) return inflight;
  inflight = fetchAllowlist()
    .then((ips) => {
      cache = { ips, expiresAt: Date.now() + CACHE_TTL_MS };
      return ips;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateAllowlistCache() {
  cache = null;
}

export function getClientIp(request: Request): string | null {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export function renderBlockedPage(ip: string | null): string {
  const safeIp = (ip ?? "unknown").replace(/[<>&"']/g, "");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Access restricted</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b0b0c;color:#e8e8ea;padding:24px}
  .card{max-width:480px;text-align:center;background:#141416;border:1px solid #26262a;border-radius:16px;padding:40px}
  h1{margin:0 0 12px;font-size:24px;font-weight:600}
  p{margin:8px 0;color:#a1a1aa;line-height:1.5}
  code{background:#1f1f23;padding:2px 8px;border-radius:6px;color:#e8e8ea;font-size:13px}
  </style></head><body><div class="card"><h1>Access restricted</h1><p>This site is only available from approved IP addresses.</p><p>Your IP: <code>${safeIp}</code></p></div></body></html>`;
}
