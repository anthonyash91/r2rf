import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type LucideIcon = ComponentType<{ className?: string }>;

type PageHeaderProps = {
  /** Lucide icon component shown before the title in the accent color. */
  icon: LucideIcon;
  /** Heading text. */
  title: ReactNode;
  /** Optional muted description rendered below the heading. */
  description?: ReactNode;
  /** Optional count appended after the title as a muted parenthetical. */
  count?: ReactNode;
  /** Render as an h1 (default) or h2 — drives default size as well. */
  as?: "h1" | "h2";
  /** Override the heading size. Defaults to "lg" for h1 and "md" for h2. */
  size?: "lg" | "md";
  /** Optional wrapper className (the outer <div>). */
  className?: string;
  /** Optional className for the heading itself. */
  headingClassName?: string;
};

/**
 * Standard admin page/section header.
 * Enforces the project rule: every admin h1/h2 has a lucide icon to its left
 * in `flex items-center gap-2`, accent-colored, sized to the heading.
 */
export function PageHeader({
  icon: Icon,
  title,
  description,
  count,
  as = "h1",
  size,
  className,
  headingClassName,
}: PageHeaderProps) {
  const Heading = as;
  const resolvedSize = size ?? (as === "h1" ? "lg" : "md");
  const headingSize =
    resolvedSize === "lg" ? "text-3xl" : "text-2xl";
  const iconSize = resolvedSize === "lg" ? "h-7 w-7" : "h-6 w-6";

  return (
    <div className={className}>
      <Heading
        className={cn(
          "font-display font-semibold flex items-center gap-2",
          headingSize,
          headingClassName,
        )}
      >
        <Icon className={cn(iconSize, "text-[var(--color-accent)]")} />
        {title}
        {count !== undefined && count !== null && (
          <span className="text-muted-foreground font-normal">({count})</span>
        )}
      </Heading>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
