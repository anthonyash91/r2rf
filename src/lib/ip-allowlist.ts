// Module-scoped cache for the IP allowlist. Refreshed periodically to keep
// the firewall responsive when admins add or remove IPs.
const CACHE_TTL_MS = 30_000;

type Cache = { ips: Set<string>; expiresAt: number };

let siteCache: Cache | null = null;
let siteInflight: Promise<Set<string>> | null = null;
let blockedCache: Cache | null = null;
let blockedInflight: Promise<Set<string>> | null = null;

type CustomHomeCache = { restrictions: Map<string, Set<string>>; expiresAt: number };
let customHomeCache: CustomHomeCache | null = null;
let customHomeInflight: Promise<Map<string, Set<string>>> | null = null;

type EnabledCache = { enabled: boolean; expiresAt: number };
let enabledCache: EnabledCache | null = null;
let enabledInflight: Promise<boolean> | null = null;


async function fetchTable(table: string): Promise<Set<string>> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(`[ip-allowlist] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (table=${table})`);
    // Fail closed — without DB access we cannot verify any IP is allowed.
    return new Set();
  }
  const res = await fetch(`${url}/rest/v1/${table}?select=ip_address`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error(`[ip-allowlist] Fetch failed for ${table}:`, res.status, await res.text());
    // Fail closed on DB error.
    return new Set();
  }
  const rows = (await res.json()) as Array<{ ip_address: string }>;
  return new Set(rows.map((r) => r.ip_address.trim()));
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



export async function getBlockedIps(): Promise<Set<string>> {
  const now = Date.now();
  if (blockedCache && blockedCache.expiresAt > now) return blockedCache.ips;
  if (blockedInflight) return blockedInflight;
  blockedInflight = fetchBlockedIps()
    .then((ips) => {
      blockedCache = { ips, expiresAt: Date.now() + CACHE_TTL_MS };
      return ips;
    })
    .finally(() => {
      blockedInflight = null;
    });
  return blockedInflight;
}

async function fetchBlockedIps(): Promise<Set<string>> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Set();
  const res = await fetch(
    `${url}/rest/v1/ip_passkey_attempts?select=ip_address&blocked_at=not.is.null`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    console.error("[ip-allowlist] Fetch blocked failed:", res.status, await res.text());
    return new Set();
  }
  const rows = (await res.json()) as Array<{ ip_address: string }>;
  return new Set(rows.map((r) => r.ip_address.trim()));
}

export function invalidateAllowlistCache() {
  siteCache = null;
  
  blockedCache = null;
  customHomeCache = null;
  enabledCache = null;
}

async function fetchIpRestrictionEnabled(): Promise<boolean> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return true;
  try {
    const res = await fetch(
      `${url}/rest/v1/site_settings?select=value&key=eq.ip_restriction_enabled`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) {
      console.error("[ip-allowlist] Fetch ip_restriction_enabled failed:", res.status, await res.text());
      return true;
    }
    const rows = (await res.json()) as Array<{ value: { enabled?: boolean } | null }>;
    if (!rows.length) return true;
    const v = rows[0]?.value;
    return v && typeof v.enabled === "boolean" ? v.enabled : true;
  } catch (err) {
    console.error("[ip-allowlist] ip_restriction_enabled error:", err);
    return true;
  }
}

export async function isIpRestrictionEnabled(): Promise<boolean> {
  const now = Date.now();
  if (enabledCache && enabledCache.expiresAt > now) return enabledCache.enabled;
  if (enabledInflight) return enabledInflight;
  enabledInflight = fetchIpRestrictionEnabled()
    .then((enabled) => {
      enabledCache = { enabled, expiresAt: Date.now() + CACHE_TTL_MS };
      return enabled;
    })
    .finally(() => {
      enabledInflight = null;
    });
  return enabledInflight;
}


async function fetchCustomHomeRestrictions(): Promise<Map<string, Set<string>>> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const map = new Map<string, Set<string>>();
  if (!url || !key) {
    console.error("[ip-allowlist] Missing SUPABASE_URL/SERVICE_ROLE_KEY for custom-home restrictions");
    return map;
  }
  const res = await fetch(`${url}/rest/v1/custom_home_pages?select=slug,allowed_ips`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error("[ip-allowlist] Fetch custom_home_pages failed:", res.status, await res.text());
    return map;
  }
  const rows = (await res.json()) as Array<{ slug: string; allowed_ips: string[] | null }>;
  for (const row of rows) {
    const ips = (row.allowed_ips ?? []).map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) map.set(row.slug, new Set(ips));
  }
  return map;
}

export async function getCustomHomeRestrictions(): Promise<Map<string, Set<string>>> {
  const now = Date.now();
  if (customHomeCache && customHomeCache.expiresAt > now) return customHomeCache.restrictions;
  if (customHomeInflight) return customHomeInflight;
  customHomeInflight = fetchCustomHomeRestrictions()
    .then((restrictions) => {
      customHomeCache = { restrictions, expiresAt: Date.now() + CACHE_TTL_MS };
      return restrictions;
    })
    .finally(() => {
      customHomeInflight = null;
    });
  return customHomeInflight;
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

export function renderBlockedPage(
  ip: string | null,
  scope: "site" | "auth" | "custom-home" | "permanent" = "site",
): string {
  const safeIp = (ip ?? "unknown").replace(/[<>&"']/g, "");
  const message = scope === "auth"
    ? "The login page is only available from approved IP addresses."
    : scope === "custom-home"
    ? "This page is only available from approved IP addresses. Contact the administrator to request access."
    : scope === "permanent"
    ? "You have unsuccessfully entered the passkey too many times. Your IP has been logged and you have been permanently blocked from this website."
    : "This site is only available from approved IP addresses.";

  const passkeyForm = scope === "site" ? `
  <form id="pk-form" style="margin-top:24px;display:flex;flex-direction:column;gap:10px;text-align:left">
    <label for="pk-label" style="font-size:13px;color:#a1a1aa">Your name or label</label>
    <input id="pk-label" type="text" autocomplete="name" placeholder="e.g. Jane Doe" required maxlength="80"
      style="background:#1f1f23;border:1px solid #2e2e34;color:#e8e8ea;padding:10px 12px;border-radius:8px;font-size:14px;outline:none"/>
    <label for="pk-input" style="font-size:13px;color:#a1a1aa;margin-top:4px">Access passkey</label>
    <div style="display:flex;gap:8px">
      <input id="pk-input" type="password" autocomplete="off" placeholder="Enter passkey" required maxlength="64"
        style="flex:1;background:#1f1f23;border:1px solid #2e2e34;color:#e8e8ea;padding:10px 12px;border-radius:8px;font-size:14px;outline:none"/>
      <button type="submit" id="pk-submit"
        style="background:#e8e8ea;color:#0b0b0c;border:0;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Unlock</button>
    </div>
    <p id="pk-msg" style="margin:0;font-size:13px;min-height:18px"></p>
  </form>
  <div id="pk-blocked" style="display:none;margin-top:24px;padding:16px;background:#3a1212;border:1px solid #7a2222;border-radius:8px;color:#fca5a5;font-size:14px;line-height:1.5">
    You have unsuccessfully entered the passkey too many times. Your IP has been logged and you have been permanently blocked from this website.
  </div>
  <script>
    (function(){
      var f=document.getElementById('pk-form');
      var inp=document.getElementById('pk-input');
      var lbl=document.getElementById('pk-label');
      var msg=document.getElementById('pk-msg');
      var btn=document.getElementById('pk-submit');
      var blocked=document.getElementById('pk-blocked');
      f.addEventListener('submit',function(e){
        e.preventDefault();
        var labelVal=(lbl.value||'').trim();
        if(!labelVal){msg.style.color='#f87171';msg.textContent='Please enter a label';return;}
        msg.style.color='#a1a1aa';msg.textContent='Checking…';btn.disabled=true;
        fetch('/api/public/site-passkey',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({passkey:inp.value,label:labelVal})
        }).then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j}})})
        .then(function(res){
          if(res.ok){msg.style.color='#34d399';msg.textContent='Access granted. Reloading…';setTimeout(function(){location.reload()},800);}
          else if(res.j&&res.j.blocked){f.style.display='none';msg.textContent='';blocked.style.display='block';}
          else{
            var remaining=res.j&&typeof res.j.remaining==='number'?res.j.remaining:null;
            var base=(res.j&&res.j.error)||'Incorrect passkey';
            msg.style.color='#f87171';
            msg.textContent=remaining!==null?base+' — '+remaining+' attempt'+(remaining===1?'':'s')+' remaining':base;
            btn.disabled=false;
          }
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
