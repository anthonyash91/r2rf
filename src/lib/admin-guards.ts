import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export async function requireAdminBeforeLoad({ location }: { location: { href: string } }) {
  // On the server (SSR / hard refresh) the Supabase client has no session cookie,
  // so any check here would incorrectly redirect. The client runs this again
  // immediately after hydration, which DOES have the session. Real security is
  // enforced by requireSupabaseAuth middleware on every server function.
  if (typeof window === "undefined") return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw redirect({ to: "/signup", search: { redirect: location.href } });
  }
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .in("role", ["admin", "contributor", "facilityUser"])
    .maybeSingle();
  if (!data) {
    throw redirect({ to: "/" });
  }
}
