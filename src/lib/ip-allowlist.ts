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
      <div style="position:relative;flex:1">
        <input id="pk-input" type="password" autocomplete="off" placeholder="Enter passkey" required maxlength="64"
          style="width:100%;box-sizing:border-box;background:#1f1f23;border:1px solid #2e2e34;color:#e8e8ea;padding:10px 40px 10px 12px;border-radius:8px;font-size:14px;outline:none"/>
        <button type="button" id="pk-eye" aria-label="Show passkey" tabindex="-1"
          style="position:absolute;top:0;right:0;height:100%;width:36px;background:transparent;border:0;color:#a1a1aa;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0">
          <svg id="pk-eye-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
      <button type="submit" id="pk-submit"
        style="background:#e8e8ea;color:#0b0b0c;border:0;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer">Unlock</button>
    </div>
    <p id="pk-msg" style="margin:0;font-size:13px;min-height:18px"></p>
  </form>
  <div id="pk-blocked" style="display:none;margin-top:24px;padding:16px;background:#3a1212;border:1px solid #7a2222;border-radius:8px;color:#fca5a5;font-size:14px;line-height:1.5">
    You have unsuccessfully entered the passkey too many times. Your IP has been logged and you have been permanently blocked from this website.
  </div>
  <style>
    #osk button[data-key]{flex:1 1 0;min-width:0;height:48px;background:#1f1f23;border:1px solid #2e2e34;color:#e8e8ea;border-radius:8px;font-size:16px;font-weight:500;cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center}
    #osk button[data-key]:active{background:#2a2a30}
    #osk button[data-key="SHIFT"],#osk button[data-key="BACK"]{flex:1.5 1 0}
    #osk button[data-key="123"],#osk button[data-key="ABC"],#osk button[data-key="ENTER"]{flex:1.5 1 0}
    #osk button[data-key="SPACE"]{flex:5 1 0;font-size:13px;color:#a1a1aa}
    #osk .osk-row{display:flex;gap:5px;width:100%}
    .pk-active{outline:2px solid #4ade80!important;outline-offset:2px}
    @media (min-width:600px){#osk button[data-key]{height:56px;font-size:18px}}
  </style>
  <div id="osk" aria-label="On-screen keyboard" style="display:none;position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#141416;border-top:1px solid #2e2e34;padding:8px 8px calc(env(safe-area-inset-bottom,0px) + 8px);box-shadow:0 -10px 32px rgba(0,0,0,.35)">
    <div style="max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;color:#a1a1aa;font-size:12px;padding:0 4px"><span>On-screen keyboard</span><button type="button" data-key="HIDE" aria-label="Hide keyboard" style="background:transparent;color:#a1a1aa;border:0;font-size:20px;padding:0 8px;line-height:1;cursor:pointer">×</button></div>
      <div class="osk-row"><button type="button" data-key="q">q</button><button type="button" data-key="w">w</button><button type="button" data-key="e">e</button><button type="button" data-key="r">r</button><button type="button" data-key="t">t</button><button type="button" data-key="y">y</button><button type="button" data-key="u">u</button><button type="button" data-key="i">i</button><button type="button" data-key="o">o</button><button type="button" data-key="p">p</button></div>
      <div class="osk-row"><button type="button" data-key="a">a</button><button type="button" data-key="s">s</button><button type="button" data-key="d">d</button><button type="button" data-key="f">f</button><button type="button" data-key="g">g</button><button type="button" data-key="h">h</button><button type="button" data-key="j">j</button><button type="button" data-key="k">k</button><button type="button" data-key="l">l</button></div>
      <div class="osk-row"><button type="button" data-key="SHIFT">⇧</button><button type="button" data-key="z">z</button><button type="button" data-key="x">x</button><button type="button" data-key="c">c</button><button type="button" data-key="v">v</button><button type="button" data-key="b">b</button><button type="button" data-key="n">n</button><button type="button" data-key="m">m</button><button type="button" data-key="BACK">⌫</button></div>
      <div class="osk-row"><button type="button" data-key="123">123</button><button type="button" data-key="SPACE">space</button><button type="button" data-key="ENTER">↵</button></div>
    </div>
  </div>
  <script>
    (function(){
      var f=document.getElementById('pk-form');
      var inp=document.getElementById('pk-input');
      var lbl=document.getElementById('pk-label');
      var msg=document.getElementById('pk-msg');
      var btn=document.getElementById('pk-submit');
      var eyeBtn=document.getElementById('pk-eye');
      var eyeIcon=document.getElementById('pk-eye-icon');
      if(eyeBtn){eyeBtn.addEventListener('click',function(){var on=inp.getAttribute('type')==='password';inp.setAttribute('type',on?'text':'password');eyeBtn.setAttribute('aria-label',on?'Hide passkey':'Show passkey');eyeIcon.innerHTML=on?'<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-10-7-10-7a18.5 18.5 0 0 1 4.22-5.18M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M9.5 9.5a3 3 0 0 0 4.24 4.24"/>':'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';});}
      var blocked=document.getElementById('pk-blocked');
      var osk=document.getElementById('osk');
      var isMobile=window.matchMedia&&window.matchMedia('(pointer: coarse) and (max-width: 900px)').matches;
      if(isMobile){inp.setAttribute('inputmode','none');lbl.setAttribute('inputmode','none');}
      var target=null,shift=false,symbols=false;
      var letterKeys=['q','w','e','r','t','y','u','i','o','p','a','s','d','f','g','h','j','k','l','z','x','c','v','b','n','m'];
      var symbolKeys=['1','2','3','4','5','6','7','8','9','0','-','/',';',':','(',')','$','&','@','.','?','!','_','#','*',','];
      function setActive(el){[inp,lbl].forEach(function(x){x.classList.remove('pk-active');});if(el)el.classList.add('pk-active');}
      function showFor(el){if(!isMobile){setActive(el);return;}target=el;setActive(el);osk.style.display='block';document.body.style.paddingBottom='340px';}
      function hide(){osk.style.display='none';document.body.style.paddingBottom='24px';setActive(null);}
      function redraw(){var i=0;osk.querySelectorAll('button[data-key]').forEach(function(b){var k=b.getAttribute('data-key');if(letterKeys.indexOf(k)>-1){var next=(symbols?symbolKeys[i]:letterKeys[i])||k;b.setAttribute('data-key',next);b.textContent=symbols?next:(shift?next.toUpperCase():next);i++;}else if(k==='123'||k==='ABC'){b.setAttribute('data-key',symbols?'ABC':'123');b.textContent=symbols?'ABC':'123';}});}
      [inp,lbl].forEach(function(el){['focus','click','touchstart','pointerdown'].forEach(function(ev){el.addEventListener(ev,function(){showFor(el);});});el.addEventListener('blur',function(){if(!isMobile)setActive(null);});});
      osk.addEventListener('mousedown',function(e){e.preventDefault();});osk.addEventListener('touchstart',function(e){e.preventDefault();},{passive:false});
      osk.addEventListener('click',function(e){var b=e.target.closest('button[data-key]');if(!b||!target)return;var k=b.getAttribute('data-key');if(k==='HIDE'){hide();return;}if(k==='SHIFT'){shift=!shift;redraw();return;}if(k==='123'||k==='ABC'){symbols=!symbols;shift=false;redraw();return;}if(k==='BACK')target.value=target.value.slice(0,-1);else if(k==='SPACE')target.value+=' ';else if(k==='ENTER')f.requestSubmit();else target.value+=shift?k.toUpperCase():k;if(shift){shift=false;redraw();}target.focus();});
      redraw();
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
