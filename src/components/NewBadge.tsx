import { cn } from "@/lib/utils";

type NewBadgeProps = {
  children: React.ReactNode;
  className?: string;
};

export function NewBadge({ children, className }: NewBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[oklch(0.35_0.05_165)] bg-[var(--color-accent)] px-2 py-0.5 text-xs font-medium text-background shadow-sm flex-shrink-0",
        className,
      )}
    >
      {children}
    </span>
  );
}
