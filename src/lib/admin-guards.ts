import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Allows only admin and contributor — blocks facilityUser from content-editing pages. */
export async function requireContentAdminBeforeLoad({ location }: { location: { href: string } }) {
  // Guards run on both client and server during SSR; skip on the server
  // since auth state only exists in the browser session.
  if (typeof window === "undefined") return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw redirect({ to: "/signup", search: { redirect: location.href } });
  }
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .in("role", ["admin", "contributor"])
    .maybeSingle();
  if (!data) {
    throw redirect({ to: "/admin/users" });
  }
}

/** Allows admin and facilityUser for user management pages — contributors are content-only. */
export async function requireUserManagementAdminBeforeLoad({ location }: { location: { href: string } }) {
  if (typeof window === "undefined") return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw redirect({ to: "/signup", search: { redirect: location.href } });
  }
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .in("role", ["admin", "facilityUser"])
    .maybeSingle();
  if (!data) {
    throw redirect({ to: "/" });
  }
}

/** Allows admin and facilityUser for analytics and messages pages — contributors excluded. */
export async function requireAnalyticsAdminBeforeLoad({ location }: { location: { href: string } }) {
  if (typeof window === "undefined") return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw redirect({ to: "/signup", search: { redirect: location.href } });
  }
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .in("role", ["admin", "facilityUser"])
    .maybeSingle();
  if (!data) {
    throw redirect({ to: "/" });
  }
}

/** Admin only — for pages where all underlying functions are admin-only. */
export async function requireStrictAdminBeforeLoad({ location }: { location: { href: string } }) {
  if (typeof window === "undefined") return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw redirect({ to: "/signup", search: { redirect: location.href } });
  }
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) {
    throw redirect({ to: "/" });
  }
}
