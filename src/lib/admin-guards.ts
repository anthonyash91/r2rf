import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Server-side session check for admin route beforeLoad functions.
 * On SSR, window is undefined so the client-side supabase.auth.getSession()
 * call cannot run. Instead we check the request cookie header for any
 * Supabase session cookie. This is a presence check only — role enforcement
 * still happens on the server functions that fetch data.
 * Dynamic import keeps @tanstack/react-start/server out of the client bundle.
 */
async function serverSessionExists(): Promise<boolean> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const cookie = req?.headers.get("cookie") ?? "";
    // Supabase session cookies follow the pattern sb-<project-ref>-auth-token
    return cookie.includes("-auth-token=");
  } catch {
    // getRequest not available (e.g., prerender context) — don't block.
    return true;
  }
}

/** Allows only admin and contributor — blocks facilityUser from content-editing pages. */
export async function requireContentAdminBeforeLoad({ location }: { location: { href: string } }) {
  if (typeof window === "undefined") {
    if (!(await serverSessionExists())) {
      throw redirect({ to: "/signup", search: { redirect: location.href } });
    }
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw redirect({ to: "/signup", search: { redirect: location.href } });
  }
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .in("role", ["admin", "contributor"]);
  if (!data || data.length === 0) {
    throw redirect({ to: "/admin/users" });
  }
}

/** Allows admin and facilityUser for user management pages — contributors are content-only. */
export async function requireUserManagementAdminBeforeLoad({ location }: { location: { href: string } }) {
  if (typeof window === "undefined") {
    if (!(await serverSessionExists())) {
      throw redirect({ to: "/signup", search: { redirect: location.href } });
    }
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw redirect({ to: "/signup", search: { redirect: location.href } });
  }
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .in("role", ["admin", "facilityUser"]);
  if (!data || data.length === 0) {
    throw redirect({ to: "/" });
  }
}

/** Allows admin and facilityUser for analytics and messages pages — contributors excluded. */
export async function requireAnalyticsAdminBeforeLoad({ location }: { location: { href: string } }) {
  if (typeof window === "undefined") {
    if (!(await serverSessionExists())) {
      throw redirect({ to: "/signup", search: { redirect: location.href } });
    }
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw redirect({ to: "/signup", search: { redirect: location.href } });
  }
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .in("role", ["admin", "facilityUser"]);
  if (!data || data.length === 0) {
    throw redirect({ to: "/" });
  }
}

/** Admin only — for pages where all underlying functions are admin-only. */
export async function requireStrictAdminBeforeLoad({ location }: { location: { href: string } }) {
  if (typeof window === "undefined") {
    if (!(await serverSessionExists())) {
      throw redirect({ to: "/signup", search: { redirect: location.href } });
    }
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw redirect({ to: "/signup", search: { redirect: location.href } });
  }
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("role", "admin");
  if (!data || data.length === 0) {
    throw redirect({ to: "/" });
  }
}
