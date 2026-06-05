import { useState } from "react";
import { useAuth, setSimulatedRole, type SimulatedRole } from "@/hooks/use-auth";
import { FlaskConical, ChevronDown, User, Shield, PenLine, HeartHandshake, Wrench } from "lucide-react";

const ROLES: { value: SimulatedRole; label: string; icon: typeof User; description: string }[] = [
  { value: "user",         label: "Regular User",   icon: User,           description: "User dashboard, no admin access" },
  { value: "admin",        label: "Admin",          icon: Shield,         description: "Full admin panel" },
  { value: "contributor",  label: "Contributor",    icon: PenLine,        description: "Content editing only" },
  { value: "facilityUser", label: "Facility User",  icon: HeartHandshake, description: "Facility-scoped analytics & users" },
];

export function RoleSwitcher() {
  const { isTester, simulatedRole } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isTester) return null;

  const current = ROLES.find((r) => r.value === simulatedRole) ?? null;
  const CurrentIcon = current?.icon ?? Wrench;

  const handleSelect = (role: SimulatedRole) => {
    setSimulatedRole(role);
    setOpen(false);
    // Navigate to the appropriate landing page for the selected role
    const dest =
      role === "admin" || role === "contributor" || role === "facilityUser"
        ? "/admin"
        : "/dashboard";
    window.location.href = dest;
  };

  return (
    <div className="fixed bottom-6 left-6 z-[300]">
      {open && (
        <div className="mb-2 rounded-2xl border border-border bg-card shadow-xl overflow-hidden w-64">
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
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border shadow-lg px-3 py-2 text-xs font-medium transition-colors"
        style={{
          color: "var(--color-accent)",
          backgroundColor: "color-mix(in oklab, var(--color-accent) 12%, transparent)",
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
