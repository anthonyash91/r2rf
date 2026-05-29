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
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-[var(--color-accent)] flex-shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex flex-col items-start">
        <p className="font-display text-2xl font-semibold leading-none tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 whitespace-nowrap">{label}</p>
      </div>
    </div>
  );
}
