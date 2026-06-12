import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, setSimulatedRole, type SimulatedRole } from "@/hooks/use-auth";
import { setTesterAnalyticsTracking } from "@/lib/users.functions";
import { FlaskConical, ChevronDown, User, Shield, PenLine, HeartHandshake, Wrench, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QK } from "@/lib/query-keys";

const ROLES: { value: SimulatedRole; label: string; icon: typeof User; description: string }[] = [
  { value: "user",         label: "Regular User",   icon: User,           description: "User dashboard, no admin access" },
  { value: "admin",        label: "Admin",          icon: Shield,         description: "Full admin panel" },
  { value: "contributor",  label: "Contributor",    icon: PenLine,        description: "Content editing only" },
  { value: "facilityUser", label: "Facility User",  icon: HeartHandshake, description: "Facility-scoped analytics & users" },
];

export function RoleSwitcher() {
  const { isTester, simulatedRole, rolesLoaded, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const qc = useQueryClient();
  const toggleFn = useServerFn(setTesterAnalyticsTracking);

  // Fetch tester's current is_synthetic state
  const { data: profileData } = useQuery({
    queryKey: QK.testerProfile(user?.id),
    enabled: !!user?.id && isTester,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("is_synthetic")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // tracking = true means analytics are enabled (is_synthetic = false)
  const tracking = profileData?.is_synthetic === false;

  async function handleToggleTracking() {
    if (toggling) return;
    setToggling(true);
    try {
      await toggleFn({ data: { enable: !tracking } });
      qc.invalidateQueries({ queryKey: QK.testerProfile(user?.id) });
    } finally {
      setToggling(false);
    }
  }

  if (!rolesLoaded || !user || !isTester) return null;

  const current = ROLES.find((r) => r.value === simulatedRole) ?? null;
  const CurrentIcon = current?.icon ?? Wrench;

  const handleSelect = (role: SimulatedRole) => {
    setSimulatedRole(role);
    setOpen(false);
    const dest =
      role === "admin" || role === "contributor" || role === "facilityUser"
        ? "/admin"
        : "/dashboard";
    window.location.href = dest;
  };

  return (
    <div className="fixed bottom-6 left-6 z-[300]">
      {open && (
        <div className="mb-2 rounded-2xl border border-border bg-card overflow-hidden w-64">
          <div className="px-4 py-3 border-b border-border/60">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Testing as</p>
          </div>
          {ROLES.map(({ value, label, icon: Icon, description }) => {
            const active = simulatedRole === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelect(value)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${active ? "bg-[var(--color-accent)]/8" : ""}`}
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border"
                  style={active ? {
                    color: "var(--color-accent)",
                    backgroundColor: "color-mix(in oklab, var(--color-accent) 12%, transparent)",
                    borderColor: "color-mix(in oklab, var(--color-accent) 25%, transparent)",
                  } : { color: "var(--color-muted-foreground)", borderColor: "var(--color-border)" }}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${active ? "text-[var(--color-accent)]" : "text-foreground"}`}>{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </button>
            );
          })}

          {/* Analytics tracking toggle */}
          <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <BarChart3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">Track analytics</p>
                <p className="text-[10px] text-muted-foreground truncate">{tracking ? "Activity counted in CPC Sales" : "Excluded from analytics"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleTracking}
              disabled={toggling}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${tracking ? "border-[var(--color-accent)]/30 bg-[var(--color-accent)]/20" : "border-border bg-muted"}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full transition-transform ${tracking ? "translate-x-4 bg-[var(--color-accent)]" : "translate-x-0.5 bg-muted-foreground/60"}`}
              />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors"
        style={{
          color: "var(--color-accent)",
          backgroundColor: "color-mix(in oklab, var(--color-accent) 15%, var(--card))",
          borderColor: "color-mix(in oklab, var(--color-accent) 25%, transparent)",
        }}
      >
        <FlaskConical className="h-3.5 w-3.5" />
        <CurrentIcon className="h-3.5 w-3.5" />
        {current?.label ?? "Tester View"}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
}
