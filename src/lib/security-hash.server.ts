import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { normalizeAnswer } from "./security-questions";

const BCRYPT_ROUNDS = 12;

// New hashes use bcrypt (slow, salted, key-stretched). Legacy hashes use
// `sha256$<salt>$<hex>` and are still accepted on verify for backward
// compatibility; users are silently upgraded when they re-enroll.
export function hashAnswer(answer: string): string {
  const norm = normalizeAnswer(answer);
  return bcrypt.hashSync(norm, BCRYPT_ROUNDS);
}

export function verifyAnswer(answer: string, stored: string): boolean {
  try {
    const norm = normalizeAnswer(answer);
    // Detect bcrypt by prefix — all three variants ($2a$, $2b$, $2y$) are valid.
    if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
      return bcrypt.compareSync(norm, stored);
    }
    // Legacy sha256$<salt>$<hex> format — uses timingSafeEqual to prevent
    // timing attacks that could reveal partial hash information.
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "sha256") return false;
    const [, salt, expected] = parts;
    const got = createHash("sha256").update(`${salt}:${norm}`).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(got, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Re-export so existing imports keep working.
export { randomBytes };
