import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Reentry to Recovery" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !user ? (
          <p className="text-muted-foreground">Redirecting…</p>
        ) : !isAdmin ? (
          <div className="rounded-2xl border border-border bg-card p-8">
            <h1 className="font-display text-2xl font-semibold">Admin access required</h1>
            <p className="mt-2 text-muted-foreground">
              You're signed in as <span className="font-medium text-foreground">{user.email}</span>,
              but your account doesn't have the <code>admin</code> role yet.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Grant yourself admin by adding a row to <code>user_roles</code> in the backend
              dashboard with your user id and <code>role = 'admin'</code>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Your user id: <code>{user.id}</code></p>
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
