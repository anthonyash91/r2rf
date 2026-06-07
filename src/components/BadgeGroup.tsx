import React, { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

export function BadgeGroup({
  children,
  className,
  trailing,
}: {
  children: React.ReactNode;
  className?: string;
  trailing?: React.ReactNode;
}) {
  const items = React.Children.toArray(children).filter(Boolean) as React.ReactElement[];
  if (items.length === 0) return null;
  if (items.length === 1 && !trailing) {
    return <div className={cn("inline-flex items-center", className)}>{items[0]}</div>;
  }
  return <WrappingBadgeGroup items={items} className={className} trailing={trailing} />;
}

function WrappingBadgeGroup({
  items,
  className,
  trailing,
}: {
  items: React.ReactElement[];
  className?: string;
  trailing?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize with full connected-pill styling (correct for single-row, fixed after measure).
  const [extraClasses, setExtraClasses] = useState<string[]>(() =>
    items.map((_, i) => buildClass(i === 0, i === items.length - 1, i !== 0))
  );

  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // Only measure badge children — trailing element (last child) is excluded.
    const els = Array.from(container.children).slice(0, items.length) as HTMLElement[];
    if (els.length !== items.length) return;

    // Group badge indices by their offsetTop — same top value = same visual row.
    const rowMap = new Map<number, number[]>();
    els.forEach((el, i) => {
      const top = el.offsetTop;
      if (!rowMap.has(top)) rowMap.set(top, []);
      rowMap.get(top)!.push(i);
    });

    const next = new Array<string>(items.length).fill("");
    rowMap.forEach((indices) => {
      indices.forEach((idx, pos) => {
        const isFirst = pos === 0;
        const isLast = pos === indices.length - 1;
        next[idx] = buildClass(isFirst, isLast, !isFirst);
      });
    });

    setExtraClasses((prev) =>
      prev.every((c, i) => c === next[i]) ? prev : next
    );
  }, [items.length]);

  useEffect(() => {
    recalc();
    const observer = new ResizeObserver(recalc);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [recalc]);

  return (
    <div ref={containerRef} className={cn("flex flex-wrap items-center gap-y-2 min-w-0", className)}>
      {items.map((child, i) => {
        const existing = (child.props as any)?.className as string | undefined;
        return React.cloneElement(child, {
          key: child.key ?? i,
          className: cn(existing, extraClasses[i]),
        } as any);
      })}
      {trailing && (
        <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
          {trailing}
        </span>
      )}
    </div>
  );
}

function buildClass(isFirst: boolean, isLast: boolean, applyNegativeMargin: boolean): string {
  return cn(
    applyNegativeMargin && "-ml-px",
    !isFirst && "rounded-l-none",
    !isLast && "rounded-r-none",
  );
}
