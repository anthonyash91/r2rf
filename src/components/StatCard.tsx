import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: ReactNode;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl border flex-shrink-0"
        style={{
          backgroundColor: "color-mix(in oklab, var(--color-accent) 12%, transparent)",
          borderColor: "color-mix(in oklab, var(--color-accent) 25%, transparent)",
          color: "var(--color-accent)",
        }}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex flex-col items-start">
        <p className="font-display text-2xl font-semibold leading-none tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap">{label}</p>
      </div>
    </div>
  );
}
