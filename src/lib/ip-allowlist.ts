// Module-scoped cache for the IP allowlist. Refreshed periodically to keep
// the firewall responsive when admins add or remove IPs.
const CACHE_TTL_MS = 30_000;

type Cache = { ips: Set<string>; expiresAt: number };

let siteCache: Cache | null = null;
let siteInflight: Promise<Set<string>> | null = null;
let authCache: Cache | null = null;
let authInflight: Promise<Set<string>> | null = null;

async function fetchTable(table: string): Promise<Set<string>> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(`[ip-allowlist] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (table=${table})`);
    return new Set(["74.138.97.209"]);
  }
  const res = await fetch(`${url}/rest/v1/${table}?select=ip_address`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`[ip-allowlist] Fetch failed for ${table}:`, res.status, await res.text());
    return new Set(["74.138.97.209"]);
  }
  const rows = (await res.json()) as Array<{ ip_address: string }>;
  const ips = new Set(rows.map((r) => r.ip_address.trim()));
  ips.add("74.138.97.209");
  return ips;
}

export async function getAllowedIps(): Promise<Set<string>> {
  const now = Date.now();
  if (siteCache && siteCache.expiresAt > now) return siteCache.ips;
  if (siteInflight) return siteInflight;
  siteInflight = fetchTable("ip_allowlist")
    .then((ips) => {
      siteCache = { ips, expiresAt: Date.now() + CACHE_TTL_MS };
      return ips;
    })
    .finally(() => {
      siteInflight = null;
    });
  return siteInflight;
}

export async function getAuthAllowedIps(): Promise<Set<string>> {
  const now = Date.now();
  if (authCache && authCache.expiresAt > now) return authCache.ips;
  if (authInflight) return authInflight;
  authInflight = fetchTable("auth_ip_allowlist")
    .then((ips) => {
      authCache = { ips, expiresAt: Date.now() + CACHE_TTL_MS };
      return ips;
    })
    .finally(() => {
      authInflight = null;
    });
  return authInflight;
}

export function invalidateAllowlistCache() {
  siteCache = null;
  authCache = null;
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

export function renderBlockedPage(ip: string | null, scope: "site" | "auth" = "site"): string {
  const safeIp = (ip ?? "unknown").replace(/[<>&"']/g, "");
  const message = scope === "auth"
    ? "The login page is only available from approved IP addresses."
    : "This site is only available from approved IP addresses.";

  const passkeyForm = scope === "site" ? `
  <form id="pk-form" style="margin-top:24px;display:flex;flex-direction:column;gap:10px;text-align:left">
    <label for="pk-input" style="font-size:13px;color:#a1a1aa">Have an access passkey?</label>
    <div style="display:flex;gap:8px">
      <input id="pk-input" type="password" autocomplete="off" placeholder="Enter passkey" required maxlength="64"
        style="flex:1;background:#1f1f23;border:1px solid #2e2e34;color:#e8e8ea;padding:10px 12px;border-radius:8px;font-size:14px;outline:none"/>
      <button type="submit" id="pk-submit"
        style="background:#e8e8ea;color:#0b0b0c;border:0;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Unlock</button>
    </div>
    <p id="pk-msg" style="margin:0;font-size:13px;min-height:18px"></p>
  </form>
  <script>
    (function(){
      var f=document.getElementById('pk-form');
      var inp=document.getElementById('pk-input');
      var msg=document.getElementById('pk-msg');
      var btn=document.getElementById('pk-submit');
      f.addEventListener('submit',function(e){
        e.preventDefault();
        msg.style.color='#a1a1aa';msg.textContent='Checking…';btn.disabled=true;
        fetch('/api/public/site-passkey',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({passkey:inp.value})
        }).then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
        .then(function(res){
          if(res.ok){msg.style.color='#34d399';msg.textContent='Access granted. Reloading…';setTimeout(function(){location.reload()},800);}
          else{msg.style.color='#f87171';msg.textContent=(res.j&&res.j.error)||'Incorrect passkey';btn.disabled=false;}
        }).catch(function(){msg.style.color='#f87171';msg.textContent='Network error';btn.disabled=false;});
      });
    })();
  </script>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Access restricted</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b0b0c;color:#e8e8ea;padding:24px}
  .card{max-width:480px;width:100%;text-align:center;background:#141416;border:1px solid #26262a;border-radius:16px;padding:40px}
  h1{margin:0 0 12px;font-size:24px;font-weight:600}
  p{margin:8px 0;color:#a1a1aa;line-height:1.5}
  code{background:#1f1f23;padding:2px 8px;border-radius:6px;color:#e8e8ea;font-size:13px}
  </style></head><body><div class="card"><h1>Access restricted</h1><p>${message}</p><p>Your IP: <code>${safeIp}</code></p>${passkeyForm}</div></body></html>`;
}
