import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sinceIsoFor } from "@/lib/date-format";

// ---------------------------------------------------------------------------
// sinceIsoFor
//
// Freeze time for every test so date calculations are deterministic.
// We use a reference date of 2026-06-12T12:00:00.000Z (noon UTC).
// ---------------------------------------------------------------------------

const FROZEN = new Date("2026-06-12T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sinceIsoFor", () => {
  it('"all" returns null — no lower bound', () => {
    expect(sinceIsoFor("all")).toBeNull();
  });

  it('"7d" returns a timestamp exactly 7 days before now', () => {
    const result = sinceIsoFor("7d");
    const expected = new Date(FROZEN.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  it('"30d" returns a timestamp exactly 30 days before now', () => {
    const result = sinceIsoFor("30d");
    const expected = new Date(FROZEN.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  it('"90d" returns a timestamp exactly 90 days before now', () => {
    const result = sinceIsoFor("90d");
    const expected = new Date(FROZEN.getTime() - 90 * 24 * 60 * 60 * 1000);
    expect(result).toBe(expected.toISOString());
  });

  it('"month" returns midnight on the first of the current month', () => {
    const result = sinceIsoFor("month");
    // FROZEN is 2026-06-12, so month start is 2026-06-01T00:00:00 local time
    const expected = new Date(FROZEN.getFullYear(), FROZEN.getMonth(), 1);
    expect(result).toBe(expected.toISOString());
  });

  it('"month" differs from "30d" — calendar month start vs rolling window', () => {
    // This encodes the intentional semantic difference documented in the function.
    const month = sinceIsoFor("month");
    const rolling = sinceIsoFor("30d");
    // On the 12th of the month, month-start is 11 days ago while 30d is further back
    expect(month).not.toBe(rolling);
    expect(new Date(month!).getDate()).toBe(1);
  });
});
