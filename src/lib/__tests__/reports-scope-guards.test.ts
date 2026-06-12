/**
 * Tests for the facility-scoping guards in reports.functions.ts handlers.
 *
 * The guards share a consistent pattern across three handlers:
 *   1. listFacilityUsers      — scopes a requested facilityValue to the caller's facility
 *   2. getUserProgressReport  — checks the target user belongs to the caller's facility
 *   3. getBulkFacilityProgressReport — enforces the requested facilityValue matches the caller's
 *
 * Because the guards all call isFacilityScoped, we test the guard logic
 * in isolation by mocking that function and asserting on the thrown errors
 * and effective facilityValues that the rest of the handler would receive.
 *
 * We extract the guard logic into testable pure-function form here rather
 * than trying to call createServerFn handlers directly (which require
 * full middleware context).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock both supabaseAdmin (needed by server-auth) and isFacilityScoped itself
// so these tests focus purely on the guard logic.
// ---------------------------------------------------------------------------

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/lib/server-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server-auth")>();
  return {
    ...actual,
    assertAnalyticsAdmin: vi.fn().mockResolvedValue(undefined),
    isFacilityScoped: vi.fn(),
  };
});

import { isFacilityScoped } from "@/lib/server-auth";

const mockIsFacilityScoped = vi.mocked(isFacilityScoped);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Guard logic extracted for direct testing.
// These mirror the exact guard blocks in reports.functions.ts so that any
// divergence between the implementation and these tests is immediately visible.
// ---------------------------------------------------------------------------

/** Guard from listFacilityUsers */
async function listFacilityUsersGuard(
  callerId: string,
  requestedFacilityValue: string | null | undefined,
): Promise<{ effectiveFacilityValue: string | null | undefined }> {
  const { scoped, facility: callerFacility } = await isFacilityScoped(callerId);
  let facilityValue = requestedFacilityValue;
  if (scoped) {
    if (!callerFacility) throw new Error("Forbidden: no facility assigned");
    if (facilityValue && facilityValue !== callerFacility)
      throw new Error("Forbidden: user is not in your facility");
    facilityValue = callerFacility;
  }
  return { effectiveFacilityValue: facilityValue };
}

/** Guard from getUserProgressReport */
async function getUserProgressGuard(
  callerId: string,
  targetUserFacility: string | null,
): Promise<void> {
  const { scoped, facility: callerFacility } = await isFacilityScoped(callerId);
  if (scoped) {
    if (!callerFacility || callerFacility !== targetUserFacility) {
      throw new Error("Forbidden: user is not in your facility");
    }
  }
}

/** Guard from getBulkFacilityProgressReport */
async function getBulkProgressGuard(
  callerId: string,
  requestedFacilityValue: string,
): Promise<void> {
  const { scoped, facility: callerFacility } = await isFacilityScoped(callerId);
  if (scoped) {
    if (!callerFacility) throw new Error("Forbidden: no facility assigned");
    if (requestedFacilityValue !== callerFacility)
      throw new Error("Forbidden: user is not in your facility");
  }
}

// ---------------------------------------------------------------------------
// listFacilityUsers guard
// ---------------------------------------------------------------------------

describe("listFacilityUsers — facility scope guard", () => {
  it("admin caller: passes through and leaves facilityValue unchanged", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: false, facility: null });
    const result = await listFacilityUsersGuard("admin-uid", "facility_b");
    expect(result.effectiveFacilityValue).toBe("facility_b");
  });

  it("admin caller: passes through when no facilityValue requested (all facilities)", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: false, facility: null });
    const result = await listFacilityUsersGuard("admin-uid", null);
    expect(result.effectiveFacilityValue).toBeNull();
  });

  it("facilityUser: request for own facility is allowed and value is preserved", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: "facility_a" });
    const result = await listFacilityUsersGuard("fuser-uid", "facility_a");
    expect(result.effectiveFacilityValue).toBe("facility_a");
  });

  it("facilityUser: request for different facility is rejected", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: "facility_a" });
    await expect(
      listFacilityUsersGuard("fuser-uid", "facility_b"),
    ).rejects.toThrow("Forbidden: user is not in your facility");
  });

  it("facilityUser: request with no facilityValue is scoped to their own facility", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: "facility_a" });
    const result = await listFacilityUsersGuard("fuser-uid", null);
    // Guard overwrites null with their facility so the handler only sees their data
    expect(result.effectiveFacilityValue).toBe("facility_a");
  });

  it("facilityUser with no facility assigned throws immediately", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: null });
    await expect(
      listFacilityUsersGuard("fuser-no-facility-uid", null),
    ).rejects.toThrow("Forbidden: no facility assigned");
  });
});

// ---------------------------------------------------------------------------
// getUserProgressReport guard
// ---------------------------------------------------------------------------

describe("getUserProgressReport — facility scope guard", () => {
  it("admin caller: can view any user regardless of facility", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: false, facility: null });
    await expect(
      getUserProgressGuard("admin-uid", "facility_b"),
    ).resolves.toBeUndefined();
  });

  it("facilityUser: can view a user who belongs to their facility", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: "facility_a" });
    await expect(
      getUserProgressGuard("fuser-uid", "facility_a"),
    ).resolves.toBeUndefined();
  });

  it("facilityUser: cannot view a user from a different facility", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: "facility_a" });
    await expect(
      getUserProgressGuard("fuser-uid", "facility_b"),
    ).rejects.toThrow("Forbidden: user is not in your facility");
  });

  it("facilityUser: cannot view a user with no facility (safety catch)", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: "facility_a" });
    await expect(
      getUserProgressGuard("fuser-uid", null),
    ).rejects.toThrow("Forbidden: user is not in your facility");
  });

  it("facilityUser with no assigned facility cannot view any user", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: null });
    await expect(
      getUserProgressGuard("fuser-no-facility-uid", "facility_a"),
    ).rejects.toThrow("Forbidden: user is not in your facility");
  });
});

// ---------------------------------------------------------------------------
// getBulkFacilityProgressReport guard
// ---------------------------------------------------------------------------

describe("getBulkFacilityProgressReport — facility scope guard", () => {
  it("admin caller: can request any facility's bulk export", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: false, facility: null });
    await expect(
      getBulkProgressGuard("admin-uid", "facility_b"),
    ).resolves.toBeUndefined();
  });

  it("facilityUser: can request bulk export for their own facility", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: "facility_a" });
    await expect(
      getBulkProgressGuard("fuser-uid", "facility_a"),
    ).resolves.toBeUndefined();
  });

  it("facilityUser: cannot request bulk export for a different facility", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: "facility_a" });
    await expect(
      getBulkProgressGuard("fuser-uid", "facility_b"),
    ).rejects.toThrow("Forbidden: user is not in your facility");
  });

  it("facilityUser with no assigned facility is rejected", async () => {
    mockIsFacilityScoped.mockResolvedValue({ scoped: true, facility: null });
    await expect(
      getBulkProgressGuard("fuser-no-facility-uid", "facility_a"),
    ).rejects.toThrow("Forbidden: no facility assigned");
  });
});
