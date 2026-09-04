import { describe, it, expect, beforeEach } from "vitest";
import { getClientIp } from "@/lib/ip-allowlist";

// getClientIp/pickXffEntry read process.env fresh on every call (not cached
// at import time), so each test must start from a clean slate — a leaked
// TRUSTED_IP_XFF_POSITION from one test silently changing another test's
// expected answer is exactly the kind of bug this suite exists to catch.
beforeEach(() => {
  delete process.env.TRUSTED_IP_HEADER;
  delete process.env.TRUSTED_IP_XFF_POSITION;
});

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request("https://example.com/", { headers });
}

describe("getClientIp — x-forwarded-for position (Render vs. Heroku)", () => {
  it("defaults to the LEFTMOST entry when TRUSTED_IP_XFF_POSITION is unset (Render's guarantee)", () => {
    const req = requestWithHeaders({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });

  it("uses the RIGHTMOST entry when TRUSTED_IP_XFF_POSITION=rightmost (Heroku's guarantee)", () => {
    process.env.TRUSTED_IP_XFF_POSITION = "rightmost";
    const req = requestWithHeaders({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" });
    expect(getClientIp(req)).toBe("3.3.3.3");
  });

  it("any value other than exactly 'rightmost' falls back to leftmost", () => {
    process.env.TRUSTED_IP_XFF_POSITION = "leftmost"; // and anything else, e.g. a typo
    const req = requestWithHeaders({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });

  it("trims whitespace around each entry", () => {
    const req = requestWithHeaders({ "x-forwarded-for": "  1.1.1.1  ,  2.2.2.2  " });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });

  it("a single-entry header returns that entry regardless of position setting", () => {
    process.env.TRUSTED_IP_XFF_POSITION = "rightmost";
    const req = requestWithHeaders({ "x-forwarded-for": "9.9.9.9" });
    expect(getClientIp(req)).toBe("9.9.9.9");
  });

  it("ignores empty entries from a trailing/double comma", () => {
    process.env.TRUSTED_IP_XFF_POSITION = "rightmost";
    const req = requestWithHeaders({ "x-forwarded-for": "1.1.1.1, ," });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });
});

describe("getClientIp — header priority", () => {
  it("prefers TRUSTED_IP_HEADER over x-forwarded-for when both are present", () => {
    process.env.TRUSTED_IP_HEADER = "cf-connecting-ip";
    const req = requestWithHeaders({
      "cf-connecting-ip": "5.5.5.5",
      "x-forwarded-for": "1.1.1.1, 2.2.2.2",
    });
    expect(getClientIp(req)).toBe("5.5.5.5");
  });

  it("falls back to x-forwarded-for when TRUSTED_IP_HEADER is set but absent on the request", () => {
    process.env.TRUSTED_IP_HEADER = "cf-connecting-ip";
    const req = requestWithHeaders({ "x-forwarded-for": "1.1.1.1" });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });

  it("falls back to x-real-ip when there is no x-forwarded-for", () => {
    const req = requestWithHeaders({ "x-real-ip": "  8.8.8.8  " });
    expect(getClientIp(req)).toBe("8.8.8.8");
  });

  it("prefers x-forwarded-for over x-real-ip when both are present", () => {
    const req = requestWithHeaders({
      "x-forwarded-for": "1.1.1.1",
      "x-real-ip": "8.8.8.8",
    });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });

  it("returns null when no relevant header is present", () => {
    const req = requestWithHeaders({});
    expect(getClientIp(req)).toBeNull();
  });

  it("treats an explicitly empty x-forwarded-for as absent and falls back to x-real-ip", () => {
    const req = requestWithHeaders({ "x-forwarded-for": "", "x-real-ip": "8.8.8.8" });
    expect(getClientIp(req)).toBe("8.8.8.8");
  });
});
