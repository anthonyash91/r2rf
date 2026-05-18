import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Reentry to Recovery" }] }),
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdminPreloaded: !!roleRow };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10">
        {loading || !user ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !isAdmin ? (
          <div className="rounded-2xl border border-border bg-card p-8">
            <h1 className="font-display text-2xl font-semibold">Admin access required</h1>
            <p className="mt-2 text-muted-foreground">
              You're signed in as <span className="font-medium text-foreground">{user.email}</span>,
              but your account doesn't have the <code>admin</code> role.
            </p>
            <Link to="/" className="mt-6 inline-block text-sm text-[var(--color-accent)] underline">
              Back to site
            </Link>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
