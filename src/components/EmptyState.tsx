import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  /** Body text / nodes to render. */
  children: ReactNode;
  /** Drop the default `p-6` padding (useful when the parent provides spacing). */
  padded?: boolean;
  /** Append `text-sm`. Default size matches the muted body text. */
  size?: "default" | "sm";
  /** Extra classes (e.g. `mt-6`, alignment). */
  className?: string;
};

/**
 * Compact muted-text placeholder used for "Loading…" / "No results yet." messages
 * inside cards, tables, and lists across the admin UI.
 */
export function EmptyState({
  children,
  padded = true,
  size = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "text-muted-foreground",
        padded && "p-6",
        size === "sm" && "text-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
