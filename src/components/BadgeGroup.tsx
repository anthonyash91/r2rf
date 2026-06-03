import React from "react";
import { cn } from "@/lib/utils";

export function BadgeGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Strip falsy children (null, undefined, false) so conditional badges
  // like {condition && <Badge />} don't create invisible gaps in the group.
  const items = React.Children.toArray(children).filter(Boolean) as React.ReactElement[];
  if (items.length === 0) return null;

  // A single badge needs no joining logic — wrap it as-is.
  if (items.length === 1) {
    return <div className={cn("inline-flex items-center", className)}>{items[0]}</div>;
  }

  // Multiple badges: remove the gap and trim the inner rounded corners so
  // adjacent badges share a border and merge into a single connected pill.
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
