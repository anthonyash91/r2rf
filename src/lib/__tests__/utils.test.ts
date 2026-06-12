import { describe, it, expect } from "vitest";
import { chunkIds } from "@/lib/utils";

// ---------------------------------------------------------------------------
// chunkIds
//
// Guards the pagination safety net: every chunked slice must fit within
// Supabase's URL length limit for .in() filters.
// ---------------------------------------------------------------------------

describe("chunkIds", () => {
  it("returns an empty array for an empty input", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("returns a single chunk when input is smaller than the chunk size", () => {
    const ids = ["a", "b", "c"];
    expect(chunkIds(ids, 500)).toEqual([["a", "b", "c"]]);
  });

  it("returns a single chunk when input is exactly the chunk size", () => {
    const ids = Array.from({ length: 500 }, (_, i) => String(i));
    const result = chunkIds(ids, 500);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(500);
  });

  it("splits into two chunks when input is one over the chunk size", () => {
    const ids = Array.from({ length: 501 }, (_, i) => String(i));
    const result = chunkIds(ids, 500);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(500);
    expect(result[1]).toHaveLength(1);
    expect(result[1][0]).toBe("500");
  });

  it("produces the correct number of chunks for a large array", () => {
    const ids = Array.from({ length: 1001 }, (_, i) => String(i));
    const result = chunkIds(ids, 500);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(500);
    expect(result[1]).toHaveLength(500);
    expect(result[2]).toHaveLength(1);
  });

  it("preserves the original order of IDs across all chunks", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `id-${i}`);
    const flat = chunkIds(ids, 5).flat();
    expect(flat).toEqual(ids);
  });

  it("respects a custom chunk size", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const result = chunkIds(ids, 2);
    expect(result).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });
});
