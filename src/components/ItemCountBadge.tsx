import { cn } from "@/lib/utils";

type ItemCountBadgeProps = {
  children: React.ReactNode;
  className?: string;
};

export function ItemCountBadge({ children, className }: ItemCountBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[oklch(0.85_0.05_85)] bg-[oklch(0.95_0.03_85)] px-2 py-0.5 text-xs font-medium text-[oklch(0.42_0.05_85)] flex-shrink-0",
        className,
      )}
    >
      {children}
    </span>
  );
}
