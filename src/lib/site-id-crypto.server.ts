import { createHmac, createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getHmacSecret(): string {
  const s = process.env.SITE_ID_HMAC_SECRET;
  if (s && s.length >= 32) return s;
  throw new Error("SITE_ID_HMAC_SECRET must be set (min 32 chars). Generate: openssl rand -hex 32");
}

function getEncryptionKey(): Buffer {
  const k = process.env.SITE_ID_ENCRYPTION_KEY;
  if (!k) throw new Error("SITE_ID_ENCRYPTION_KEY must be set. Generate: openssl rand -hex 32");
  const buf = Buffer.from(k, "hex");
  if (buf.length !== 32) throw new Error("SITE_ID_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

/** Deterministic HMAC used for indexed WHERE lookups. */
export function hashSiteId(siteId: string): string {
  return createHmac("sha256", getHmacSecret()).update(siteId).digest("hex");
}

/**
 * AES-256-GCM encryption. Each call produces a unique ciphertext (random IV).
 * Stored as base64url: [12-byte IV][16-byte auth tag][ciphertext].
 */
export function encryptSiteId(siteId: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(siteId, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

/** Decrypts a value produced by encryptSiteId. Throws if tampered or key is wrong. */
export function decryptSiteId(encoded: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(encoded, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}
