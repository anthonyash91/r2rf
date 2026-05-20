import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { getMyProfile } from "@/lib/user-signup.functions";
import { facilityLabel } from "@/lib/user-signup";
import { User as UserIcon, Building2, Calendar } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Reentry to Recovery" }] }),
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw redirect({ to: "/signup", search: { redirect: location.href } as any });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const fetchProfile = useServerFn(getMyProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
  });

  const profile = data?.profile;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account information.</p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : !profile ? (
            <div>
              <p className="text-muted-foreground">No profile found for your account.</p>
              <Link to="/" className="mt-3 inline-block text-sm underline">Back home</Link>
            </div>
          ) : (
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5" /> Username
                </dt>
                <dd className="mt-1 font-medium">{profile.username}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Facility
                </dt>
                <dd className="mt-1 font-medium">{facilityLabel(profile.facility)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Joined
                </dt>
                <dd className="mt-1 font-medium">
                  {new Date(profile.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
