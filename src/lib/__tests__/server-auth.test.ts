import { describe, it, expect, vi, beforeEach } from "vitest";
import { assertAnalyticsAdmin, isFacilityScoped } from "@/lib/server-auth";

// ---------------------------------------------------------------------------
// Mock supabaseAdmin — the query builder chains .select().eq().in() before
// resolving, so each mock needs to be both chainable and thenable.
//
// vi.mock factories are hoisted before variable declarations, so the mock
// object must be created via vi.hoisted() to be available inside the factory.
// ---------------------------------------------------------------------------

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: mockSupabase,
}));

/**
 * Creates a chainable + thenable Supabase query mock.
 * All builder methods (select, eq, in, maybeSingle) return `this` so
 * they can be chained freely; the final await resolves to `result`.
 */
function mockQuery(result: { data: any; error?: any }) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    // Making the chain thenable lets `await supabaseAdmin.from(...).select(...)...`
    // resolve when there is no terminal call like maybeSingle().
    then: (resolve: (v: any) => any, reject?: (e: any) => any) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// assertAnalyticsAdmin
// ---------------------------------------------------------------------------

describe("assertAnalyticsAdmin", () => {
  it("resolves for a user with the admin role", async () => {
    mockSupabase.from.mockReturnValue(
      mockQuery({ data: [{ role: "admin" }] }),
    );
    await expect(assertAnalyticsAdmin("admin-uid")).resolves.toBeUndefined();
  });

  it("resolves for a user with the facilityUser role", async () => {
    mockSupabase.from.mockReturnValue(
      mockQuery({ data: [{ role: "facilityUser" }] }),
    );
    await expect(assertAnalyticsAdmin("facility-uid")).resolves.toBeUndefined();
  });

  it("throws for a regular user with no qualifying role", async () => {
    mockSupabase.from.mockReturnValue(mockQuery({ data: [] }));
    await expect(assertAnalyticsAdmin("user-uid")).rejects.toThrow(
      "Forbidden: analytics admin access required",
    );
  });

  it("throws when the DB returns null data", async () => {
    mockSupabase.from.mockReturnValue(mockQuery({ data: null }));
    await expect(assertAnalyticsAdmin("user-uid")).rejects.toThrow("Forbidden");
  });
});

// ---------------------------------------------------------------------------
// isFacilityScoped
// ---------------------------------------------------------------------------

describe("isFacilityScoped", () => {
  it("returns unscoped for an admin user", async () => {
    mockSupabase.from.mockReturnValue(
      mockQuery({ data: [{ role: "admin" }] }),
    );
    const result = await isFacilityScoped("admin-uid");
    expect(result).toEqual({ scoped: false, facility: null });
    // Should not query user_profiles — admin scope check short-circuits
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it("returns unscoped for a tester who holds both admin and facilityUser roles", async () => {
    // Testers have both roles; admin takes precedence so they see all facilities
    mockSupabase.from.mockReturnValue(
      mockQuery({ data: [{ role: "admin" }, { role: "facilityUser" }] }),
    );
    const result = await isFacilityScoped("tester-uid");
    expect(result).toEqual({ scoped: false, facility: null });
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it("returns scoped with the correct facility for a facilityUser", async () => {
    // First call: user_roles → facilityUser only
    // Second call: user_profiles → facility value
    mockSupabase.from
      .mockReturnValueOnce(mockQuery({ data: [{ role: "facilityUser" }] }))
      .mockReturnValueOnce(
        mockQuery({ data: { facility: "facility_abc" } }),
      );
    const result = await isFacilityScoped("fuser-uid");
    expect(result).toEqual({ scoped: true, facility: "facility_abc" });
    expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    expect(mockSupabase.from).toHaveBeenNthCalledWith(1, "user_roles");
    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, "user_profiles");
  });

  it("returns scoped with null facility when facilityUser has no profile facility", async () => {
    mockSupabase.from
      .mockReturnValueOnce(mockQuery({ data: [{ role: "facilityUser" }] }))
      .mockReturnValueOnce(mockQuery({ data: null }));
    const result = await isFacilityScoped("fuser-no-facility-uid");
    expect(result).toEqual({ scoped: true, facility: null });
  });

  it("returns unscoped for a regular user with no admin or facilityUser role", async () => {
    mockSupabase.from.mockReturnValue(mockQuery({ data: [] }));
    const result = await isFacilityScoped("regular-uid");
    expect(result).toEqual({ scoped: false, facility: null });
    // Should not query user_profiles — no facilityUser role means no scope lookup needed
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });
});
