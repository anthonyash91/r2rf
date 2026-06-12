import { describe, it, expect } from "vitest";
import { csvEscape } from "@/lib/csv-utils";

// ---------------------------------------------------------------------------
// csvEscape
//
// RFC 4180: a field must be wrapped in double-quotes if it contains a
// double-quote, comma, or newline. Any double-quotes inside the field
// must be doubled (""). Fields without those characters pass through unchanged.
//
// This matters for user-generated content (names, usernames, facility labels,
// achievement descriptions) that ends up in CSV exports.
// ---------------------------------------------------------------------------

describe("csvEscape", () => {
  // ── clean values — no escaping needed ─────────────────────────────────────

  it("returns a plain string unchanged", () => {
    expect(csvEscape("hello world")).toBe("hello world");
  });

  it("returns a number as its string form, unchanged", () => {
    expect(csvEscape(42)).toBe("42");
    expect(csvEscape(0)).toBe("0");
    expect(csvEscape(3.14)).toBe("3.14");
  });

  it("returns an empty string unchanged", () => {
    expect(csvEscape("")).toBe("");
  });

  // ── values that must be quoted ─────────────────────────────────────────────

  it("wraps a string containing a comma in double-quotes", () => {
    expect(csvEscape("Smith, John")).toBe('"Smith, John"');
  });

  it("wraps a string containing a double-quote in double-quotes and doubles the inner quote", () => {
    // Input:  He said "hello"
    // Output: "He said ""hello"""
    expect(csvEscape('He said "hello"')).toBe('"He said ""hello"""');
  });

  it("wraps a string containing a newline in double-quotes", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps a string containing a carriage-return+newline in double-quotes", () => {
    // \r alone does not trigger quoting per the regex, but \n does
    expect(csvEscape("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  // ── edge cases with multiple special characters ────────────────────────────

  it("handles a string with both a comma and a double-quote", () => {
    // Input:  "yes", he said
    // Output: """yes"", he said"
    expect(csvEscape('"yes", he said')).toBe('"""yes"", he said"');
  });

  it("handles a string that is only a double-quote", () => {
    expect(csvEscape('"')).toBe('""""');
  });

  it("handles a string that is only a comma", () => {
    expect(csvEscape(",")).toBe('","');
  });

  it("handles a string that is only a newline", () => {
    expect(csvEscape("\n")).toBe('"\n"');
  });

  // ── real-world content from this app ──────────────────────────────────────

  it("passes through a typical username unchanged", () => {
    expect(csvEscape("jdoe_92")).toBe("jdoe_92");
  });

  it("quotes a facility label with a comma (e.g. 'Pennington, SD')", () => {
    expect(csvEscape("Pennington, SD")).toBe('"Pennington, SD"');
  });

  it("doubles quotes in an achievement description with quoted text", () => {
    const desc = 'Earned "Top Reader" status';
    expect(csvEscape(desc)).toBe('"Earned ""Top Reader"" status"');
  });
});
