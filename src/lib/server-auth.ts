import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Shared server-side auth assertion helpers.
 * All checks use supabaseAdmin so role lookups are never gated by the
 * caller's own RLS permissions.
 */

export async function assertAdmin(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

export async function assertAdminOrContributor(userId: string): Promise<void> {
  const [adminRes, contribRes] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "contributor" }),
  ]);
  if (!adminRes.data && !contribRes.data) {
    throw new Error("Forbidden: admin or contributor access required");
  }
}

/** Admin or facilityUser — used for analytics and user-management endpoints. */
export async function assertAnalyticsAdmin(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "facilityUser"]);
  if (!data || data.length === 0) {
    throw new Error("Forbidden: analytics admin access required");
  }
}

/**
 * Returns whether the caller should be scoped to their own facility.
 * Callers with the admin role are never scoped — they see all facilities.
 * Handles tester accounts that hold both admin and facilityUser roles.
 */
export async function isFacilityScoped(
  userId: string,
): Promise<{ scoped: boolean; facility: string | null }> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "facilityUser"]);
  const hasAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  if (hasAdmin) return { scoped: false, facility: null };
  const hasFacilityUser = (roles ?? []).some((r: any) => r.role === "facilityUser");
  if (!hasFacilityUser) return { scoped: false, facility: null };
  const { data: prof } = await supabaseAdmin
    .from("user_profiles")
    .select("facility")
    .eq("user_id", userId)
    .maybeSingle();
  return { scoped: true, facility: (prof?.facility as string | null) ?? null };
}
