// HMAC-signed cookie for short-lived passkey unlock grants.
// The cookie is tied to the client IP and a timestamp so it cannot be
// replayed indefinitely or forged without the server secret.

const COOKIE_NAME = "site_passkey_ok";
const MAX_AGE_SECONDS = 300;

function getSecret(): string | null {
  const secret = process.env.SITE_PASSKEY_HASH?.trim();
  return secret && secret.length > 0 ? secret : null;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function buildPasskeyCookie(ip: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = await hmacHex(secret, `${ip}.${ts}`);
  const value = `${ts}.${sig}`;
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax; Secure; HttpOnly`;
}

export async function verifyPasskeyCookie(
  cookieHeader: string | null,
  ip: string | null,
): Promise<boolean> {
  if (!cookieHeader || !ip) return false;
  const secret = getSecret();
  if (!secret) return false;

  const raw = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return false;
  const value = raw.slice(COOKIE_NAME.length + 1);
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const ts = value.slice(0, dot);
  const providedSig = value.slice(dot + 1);
  if (!/^\d+$/.test(ts) || !/^[0-9a-f]+$/i.test(providedSig)) return false;

  const tsNum = Number(ts);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(tsNum) || nowSec - tsNum > MAX_AGE_SECONDS || tsNum > nowSec + 60) {
    return false;
  }

  const expected = await hmacHex(secret, `${ip}.${ts}`);
  return timingSafeEqualHex(providedSig.toLowerCase(), expected.toLowerCase());
}
