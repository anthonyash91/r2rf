import { useEffect, useReducer, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { setActiveFacilitySlug } from "@/lib/facility-context";

export type AppRole = "admin" | "contributor" | "user" | "tester" | "facilityUser";
export type SimulatedRole = "user" | "admin" | "contributor" | "facilityUser";

// ── Module-level simulated role state ──────────────────────────────────────
const SIM_KEY = "tester_sim_role";
const ROLES_CACHE_KEY = "auth_roles_cache";
const USER_ID_CACHE_KEY = "auth_current_user_id";

let simulatedRole: SimulatedRole | null = null;
try {
  simulatedRole = (localStorage.getItem(SIM_KEY) as SimulatedRole) ?? null;
} catch { /* SSR / no window */ }

// Read roles from sessionStorage synchronously — eliminates the blank flash
// between page load and the first async DB roles fetch completing.
function readCachedRoles(): AppRole[] {
  try {
    const raw = sessionStorage.getItem(ROLES_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AppRole[]) : [];
  } catch { return []; }
}

function writeCachedRoles(roles: AppRole[]) {
  try { sessionStorage.setItem(ROLES_CACHE_KEY, JSON.stringify(roles)); } catch { /* ignore */ }
}

function clearCachedRoles() {
  try {
    sessionStorage.removeItem(ROLES_CACHE_KEY);
    sessionStorage.removeItem(USER_ID_CACHE_KEY);
  } catch { /* ignore */ }
}

/** Read the logged-in user's ID synchronously from sessionStorage. */
export function getCachedUserId(): string | null {
  try { return sessionStorage.getItem(USER_ID_CACHE_KEY); } catch { return null; }
}

const listeners = new Set<() => void>();

export function setSimulatedRole(role: SimulatedRole | null) {
  simulatedRole = role;
  try {
    if (role) localStorage.setItem(SIM_KEY, role);
    else localStorage.removeItem(SIM_KEY);
  } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}

export function getSimulatedRole(): SimulatedRole | null {
  return simulatedRole;
}

// ── Hook ────────────────────────────────────────────────────────────────────
export function useAuth() {
  // Initialize roles from sessionStorage cache so the first render already
  // has the correct roles — no blank/loading flash between navigation and
  // the async DB fetch completing.
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>(() => readCachedRoles());
  const [loading, setLoading] = useState(true);
  // If we have cached roles the user is effectively "loaded" — the background
  // fetch will refresh them but there's no UX gap to hide.
  const [rolesLoaded, setRolesLoaded] = useState(() => readCachedRoles().length > 0);
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    listeners.add(forceUpdate);
    return () => { listeners.delete(forceUpdate); };
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
        writeCachedRoles(userRoles);
        try { sessionStorage.setItem(USER_ID_CACHE_KEY, userId); } catch { /* ignore */ }
        if (userRoles.includes("admin") || userRoles.includes("contributor")) {
          setActiveFacilitySlug(null);
        }
        // If this user is not a tester, erase any leftover simulation key so
        // it can never grant elevated access to a non-tester account.
        if (!userRoles.includes("tester")) {
          try { localStorage.removeItem(SIM_KEY); } catch { /* ignore */ }
          simulatedRole = null;
          listeners.forEach((fn) => fn());
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
        // Sign-out: clear cache and reset to empty so the next user starts clean.
        clearCachedRoles();
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
        clearCachedRoles();
        setRolesLoaded(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isTester = roles.includes("tester");
  const sim = isTester ? simulatedRole : null;

  const isAdmin        = sim ? sim === "admin"        : (!isTester && roles.includes("admin"));
  const isContributor  = sim ? sim === "contributor"  : (!isTester && roles.includes("contributor"));
  const isUser         = sim ? sim === "user"         : (!isTester && roles.includes("user"));
  const isFacilityUser = sim ? sim === "facilityUser" : (!isTester && roles.includes("facilityUser"));

  const simFromStorage = simulatedRole;
  const storageGrantsAdmin = isTester && !!session?.user && (
    simFromStorage === "admin" ||
    simFromStorage === "contributor" ||
    simFromStorage === "facilityUser"
  );

  return {
    session,
    user: session?.user ?? null,
    roles,
    isAdmin,
    isContributor,
    isUser: isUser || (!sim && isTester),
    isTester,
    isFacilityUser,
    canAccessAdmin: isAdmin || isContributor || isFacilityUser || storageGrantsAdmin,
    simulatedRole: sim,
    loading,
    rolesLoaded,
  };
}
