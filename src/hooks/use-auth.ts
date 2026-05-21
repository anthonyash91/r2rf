import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { setActiveCustomHome } from "@/lib/custom-home-context";
import { getMyFacilityCustomHome } from "@/lib/user-signup.functions";

export type AppRole = "admin" | "contributor" | "user";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  function loadRoles(userId: string) {
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        setRoles(((data ?? []).map((r: any) => r.role)) as AppRole[]);
      });
  }

  function syncFacilityCustomHome() {
    getMyFacilityCustomHome()
      .then((res) => {
        if (res?.slug) setActiveCustomHome(res.slug);
      })
      .catch(() => {
        /* ignore */
      });
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadRoles(s.user.id), 0);
        setTimeout(() => syncFacilityCustomHome(), 0);
      } else {
        setRoles([]);
        setActiveCustomHome(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      if (s?.user) {
        loadRoles(s.user.id);
        syncFacilityCustomHome();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("admin");
  const isContributor = roles.includes("contributor");
  const isUser = roles.includes("user");

  return {
    session,
    user: session?.user ?? null,
    roles,
    isAdmin,
    isContributor,
    isUser,
    canAccessAdmin: isAdmin || isContributor,
    loading,
  };
}
