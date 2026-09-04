import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "crypto";
import { hashPin, verifyPin, hashAnswer, verifyAnswer } from "@/lib/security-hash.server";

// A valid 32+ char secret, matching the app's own `openssl rand -hex 32` convention.
const TEST_SECRET = "a".repeat(64);

beforeEach(() => {
  process.env.SIGNUP_CHALLENGE_SECRET = TEST_SECRET;
});

describe("hashPin / verifyPin", () => {
  it("throws when SIGNUP_CHALLENGE_SECRET is unset", () => {
    delete process.env.SIGNUP_CHALLENGE_SECRET;
    expect(() => hashPin("123456")).toThrow(/SIGNUP_CHALLENGE_SECRET/);
  });

  it("throws when SIGNUP_CHALLENGE_SECRET is shorter than 32 chars", () => {
    process.env.SIGNUP_CHALLENGE_SECRET = "too-short";
    expect(() => hashPin("123456")).toThrow(/SIGNUP_CHALLENGE_SECRET/);
  });

  it("is deterministic for the same PIN and secret", () => {
    expect(hashPin("123456")).toBe(hashPin("123456"));
  });

  it("produces a different hash for a different secret", () => {
    const first = hashPin("123456");
    process.env.SIGNUP_CHALLENGE_SECRET = "b".repeat(64);
    expect(hashPin("123456")).not.toBe(first);
  });

  it("trims whitespace before hashing, matching signup's own trim", () => {
    expect(hashPin("123456")).toBe(hashPin("  123456  "));
  });

  it("verifyPin accepts the correct PIN against its own hash", () => {
    const stored = hashPin("123456");
    expect(verifyPin("123456", stored)).toBe(true);
  });

  it("verifyPin rejects an incorrect PIN", () => {
    const stored = hashPin("123456");
    expect(verifyPin("654321", stored)).toBe(false);
  });

  it("verifyPin returns false (not throw) for a malformed/short stored hash", () => {
    expect(verifyPin("123456", "not-a-real-hash")).toBe(false);
  });
});

describe("hashAnswer / verifyAnswer", () => {
  it("round-trips a correct answer", async () => {
    const stored = await hashAnswer("Blue");
    expect(await verifyAnswer("Blue", stored)).toBe(true);
  });

  it("normalizes case and surrounding whitespace before comparing", async () => {
    const stored = await hashAnswer("Blue");
    expect(await verifyAnswer("  blue  ", stored)).toBe(true);
  });

  it("rejects an incorrect answer", async () => {
    const stored = await hashAnswer("Blue");
    expect(await verifyAnswer("Red", stored)).toBe(false);
  });

  it("produces a bcrypt hash ($2a/$2b/$2y prefix), not the legacy format", async () => {
    const stored = await hashAnswer("Blue");
    expect(stored).toMatch(/^\$2[aby]\$/);
  });

  it("accepts a correct answer against a legacy sha256$salt$hex hash", async () => {
    // Reconstructs the legacy format exactly as described in the source:
    // sha256$<salt>$<hex of sha256(`${salt}:${normalizedAnswer}`)>.
    const salt = "some-legacy-salt";
    const normalized = "blue"; // normalizeAnswer("Blue") === "blue"
    const hex = createHash("sha256").update(`${salt}:${normalized}`).digest("hex");
    const legacyStored = `sha256$${salt}$${hex}`;
    expect(await verifyAnswer("Blue", legacyStored)).toBe(true);
  });

  it("rejects an incorrect answer against a legacy sha256$salt$hex hash", async () => {
    const salt = "some-legacy-salt";
    const hex = createHash("sha256").update(`${salt}:blue`).digest("hex");
    const legacyStored = `sha256$${salt}$${hex}`;
    expect(await verifyAnswer("Red", legacyStored)).toBe(false);
  });

  it("returns false (not throw) for a garbled stored value", async () => {
    expect(await verifyAnswer("Blue", "complete-nonsense")).toBe(false);
  });

  it("returns false (not throw) for an empty stored value", async () => {
    expect(await verifyAnswer("Blue", "")).toBe(false);
  });
});
