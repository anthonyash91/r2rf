import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { AdminNav } from "@/components/AdminNav";
import { SectionCard } from "@/components/SectionCard";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Reentry to Recovery" }] }),
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw redirect({ to: "/signup", search: { redirect: location.href } });
    }
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    const roles = (roleRows ?? []).map((r: any) => r.role as string);
    return {
      isAdminPreloaded: roles.includes("admin"),
      isContributorPreloaded: roles.includes("contributor"),
    };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { user, canAccessAdmin, loading, rolesLoaded } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10">
        {loading || !rolesLoaded || !user ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !canAccessAdmin ? (
          <SectionCard as="div" padded={false} className="p-8">
            <h1 className="font-display text-2xl font-semibold">Admin access required</h1>
            <p className="mt-2 text-muted-foreground">
              You're signed in as <span className="font-medium text-foreground">{user.email}</span>,
              but your account doesn't have an admin or contributor role.
            </p>
            <Link to="/" className="mt-6 inline-block text-sm text-[var(--color-accent)] underline">
              Back to site
            </Link>
          </SectionCard>
        ) : (
          <>
            <AdminNav />
            <Outlet />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
