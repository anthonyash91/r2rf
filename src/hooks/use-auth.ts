import { useEffect, useReducer, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { setActiveFacilitySlug } from "@/lib/facility-context";

export type AppRole = "admin" | "contributor" | "user" | "tester" | "facilityUser";
export type SimulatedRole = "user" | "admin" | "contributor" | "facilityUser";

// ── Module-level simulated role state ──────────────────────────────────────
// Shared across all useAuth() instances. When a tester switches their view,
// every component that calls useAuth() re-renders automatically.
const SIM_KEY = "tester_sim_role";

let _simulatedRole: SimulatedRole | null = null;
try {
  _simulatedRole = (localStorage.getItem(SIM_KEY) as SimulatedRole) ?? null;
} catch { /* SSR / no window */ }

const _listeners = new Set<() => void>();

export function setSimulatedRole(role: SimulatedRole | null) {
  _simulatedRole = role;
  try {
    if (role) localStorage.setItem(SIM_KEY, role);
    else localStorage.removeItem(SIM_KEY);
  } catch { /* ignore */ }
  _listeners.forEach((fn) => fn());
}

export function getSimulatedRole(): SimulatedRole | null {
  return _simulatedRole;
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  // Force re-render when the simulated role changes globally.
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    _listeners.add(forceUpdate);
    return () => { _listeners.delete(forceUpdate); };
  }, []);

  function loadRoles(userId: string) {
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => {
        const userRoles = ((data ?? []).map((r: any) => r.role)) as AppRole[];
        setRoles(userRoles);
        setRolesLoaded(true);
        if (userRoles.includes("admin") || userRoles.includes("contributor")) {
          setActiveFacilitySlug(null);
        }
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
    } catch { /* ignore */ }
    supabase
      .from("user_logins")
      .upsert({ user_id: userId, login_date }, { onConflict: "user_id,login_date" })
      .then(() => {
        try {
          if (typeof window !== "undefined") window.sessionStorage.setItem(key, "1");
        } catch { /* ignore */ }
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
        setRolesLoaded(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
      if (s?.user) {
        loadRoles(s.user.id);
        logDailyLogin(s.user.id);
      } else {
        setRolesLoaded(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Effective roles ────────────────────────────────────────────────────
  // Testers with a simulated role active: present as if they only hold that
  // role (plus tester, which is always retained). All other accounts are
  // unaffected — _simulatedRole only activates for tester accounts.
  const isTester = roles.includes("tester");
  const sim = isTester ? _simulatedRole : null;

  const isAdmin       = sim ? sim === "admin"       : roles.includes("admin");
  const isContributor = sim ? sim === "contributor" : roles.includes("contributor");
  const isUser        = sim ? sim === "user"        : roles.includes("user");
  const isFacilityUser = sim ? sim === "facilityUser" : roles.includes("facilityUser");

  return {
    session,
    user: session?.user ?? null,
    roles,
    isAdmin,
    isContributor,
    isUser: isUser || (!sim && isTester),
    isTester,
    isFacilityUser,
    canAccessAdmin: isAdmin || isContributor || isFacilityUser,
    simulatedRole: sim,
    loading,
    rolesLoaded,
  };
}
