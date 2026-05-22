import { cn } from "@/lib/utils";

type ItemCountBadgeProps = {
  children: React.ReactNode;
  className?: string;
};

export function ItemCountBadge({ children, className }: ItemCountBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[oklch(0.42_0.05_85)] bg-[var(--color-gold)] px-2 py-0.5 text-xs font-medium text-background flex-shrink-0",
        className,
      )}
    >
      {children}
    </span>
  );
}
