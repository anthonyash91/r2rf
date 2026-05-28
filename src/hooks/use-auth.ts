import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "contributor" | "user" | "tester" | "facilityUser";

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

  function logDailyLogin(userId: string) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const login_date = `${y}-${m}-${d}`;
    const key = `login-logged:${userId}:${login_date}`;
    try {
      if (typeof window !== "undefined" && window.sessionStorage.getItem(key)) return;
    } catch {
      /* ignore */
    }
    supabase
      .from("user_logins")
      .upsert({ user_id: userId, login_date }, { onConflict: "user_id,login_date" })
      .then(() => {
        try {
          if (typeof window !== "undefined") window.sessionStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
      });
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadRoles(s.user.id), 0);
        setTimeout(() => logDailyLogin(s.user.id), 0);
      } else {
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      if (s?.user) {
        loadRoles(s.user.id);
        logDailyLogin(s.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("admin");
  const isContributor = roles.includes("contributor");
  const isUser = roles.includes("user");
  const isTester = roles.includes("tester");
  const isFacilityUser = roles.includes("facilityUser");

  return {
    session,
    user: session?.user ?? null,
    roles,
    isAdmin,
    isContributor,
    isUser: isUser || isTester,
    isTester,
    isFacilityUser,
    canAccessAdmin: isAdmin || isContributor,
    loading,
  };
}
