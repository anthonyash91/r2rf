import { cn } from "@/lib/utils";

type NewBadgeProps = {
  children: React.ReactNode;
  className?: string;
};

export function NewBadge({ children, className }: NewBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[oklch(0.85_0.03_165)] bg-[oklch(0.95_0.02_165)] px-2 py-0.5 text-xs font-medium text-[oklch(0.35_0.05_165)] flex-shrink-0",
        className,
      )}
    >
      {children}
    </span>
  );
}
