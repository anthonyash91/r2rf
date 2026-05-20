import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { normalizeAnswer } from "./security-questions";

// Hash format: sha256$<saltHex>$<hashHex>
export function hashAnswer(answer: string): string {
  const salt = randomBytes(16).toString("hex");
  const norm = normalizeAnswer(answer);
  const hash = createHash("sha256").update(`${salt}:${norm}`).digest("hex");
  return `sha256$${salt}$${hash}`;
}

export function verifyAnswer(answer: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts.length !== 3 || parts[0] !== "sha256") return false;
    const [, salt, expected] = parts;
    const norm = normalizeAnswer(answer);
    const got = createHash("sha256").update(`${salt}:${norm}`).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(got, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
