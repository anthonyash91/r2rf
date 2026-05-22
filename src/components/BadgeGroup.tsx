import React from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps a set of <Badge /> elements so adjacent ones visually connect
 * into a single pill: no gap, and rounded corners only on the outer edges.
 * Falsy children (e.g. {condition && <Badge .../>}) are ignored.
 *
 * Usage:
 *   <BadgeGroup>
 *     <Badge variant="count">3 items</Badge>
 *     {isNew && <Badge variant="new">New</Badge>}
 *   </BadgeGroup>
 */
export function BadgeGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const items = React.Children.toArray(children).filter(Boolean) as React.ReactElement[];
  if (items.length === 0) return null;
  if (items.length === 1) {
    return <div className={cn("inline-flex items-center", className)}>{items[0]}</div>;
  }
  return (
    <div className={cn("inline-flex items-center", className)}>
      {items.map((child, i) => {
        const isFirst = i === 0;
        const isLast = i === items.length - 1;
        const extra = cn(
          !isFirst && "rounded-l-none -ml-px",
          !isLast && "rounded-r-none",
        );
        const existing = (child.props as any)?.className as string | undefined;
        return React.cloneElement(child, {
          key: child.key ?? i,
          className: cn(existing, extra),
        } as any);
      })}
    </div>
  );
}
