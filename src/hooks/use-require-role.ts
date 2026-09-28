import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

/**
 * Client-side backstop for the route `beforeLoad` guards in admin-guards.ts.
 * Those guards only run for in-app client-side navigation (clicking a <Link>
 * while the app is already running) — TanStack Start does not re-run
 * beforeLoad on the client for whichever route was matched during the
 * initial server render, so a hard page load or browser refresh landing
 * directly on a /admin/* URL skips them entirely, both server and client
 * (confirmed via debug logging against a production build — the guard
 * function never executes in that path). These hooks close that gap using
 * useAuth(), which reliably updates on every load path since it drives its
 * own client-side session check independent of route loaders.
 *
 * Each page component calls the matching hook and only renders its real
 * content once it returns true — otherwise a signed-out visitor briefly sees
 * a loading state while the redirect effect fires, instead of the real page.
 */
function useRequireRole(allowed: boolean, redirectTo: string): boolean {
  const { user, loading, rolesLoaded } = useAuth();
  const navigate = useNavigate();
  const resolved = !loading && rolesLoaded;

  useEffect(() => {
    if (!resolved) return;
    if (!user) {
      navigate({ to: "/signup", search: { redirect: window.location.href } });
    } else if (!allowed) {
      navigate({ to: redirectTo as any });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, user, allowed, navigate, redirectTo]);

  return resolved && !!user && allowed;
}

/** Admin only — matches requireStrictAdminBeforeLoad. */
export function useRequireAdmin(): boolean {
  const { isAdmin } = useAuth();
  return useRequireRole(isAdmin, "/");
}

/** Admin or contributor — matches requireContentAdminBeforeLoad. */
export function useRequireContentAdmin(): boolean {
  const { isAdmin, isContributor } = useAuth();
  return useRequireRole(isAdmin || isContributor, "/admin/users");
}

/** Admin or facilityUser — matches requireUserManagementAdminBeforeLoad. */
export function useRequireUserManagementAdmin(): boolean {
  const { isAdmin, isFacilityUser } = useAuth();
  return useRequireRole(isAdmin || isFacilityUser, "/");
}

/** Admin or facilityUser — matches requireAnalyticsAdminBeforeLoad. */
export function useRequireAnalyticsAdmin(): boolean {
  const { isAdmin, isFacilityUser } = useAuth();
  return useRequireRole(isAdmin || isFacilityUser, "/");
}
