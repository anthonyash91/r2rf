import React from "react";
import { cn } from "@/lib/utils";

/**
 * Like BadgeGroup but only visually connects adjacent badges when they all
 * fit on the same row. If the container forces a child to wrap to a new
 * line, badges separate (gap appears, corners become individually rounded).
 */
export function ResponsiveBadgeGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const items = React.Children.toArray(children).filter(Boolean) as React.ReactElement[];
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [wrapped, setWrapped] = React.useState(false);

  React.useLayoutEffect(() => {
    if (items.length < 2) {
      setWrapped(false);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const check = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      if (kids.length < 2) {
        setWrapped(false);
        return;
      }
      const firstTop = kids[0].offsetTop;
      const isWrapped = kids.some((k) => k.offsetTop !== firstTop);
      setWrapped(isWrapped);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [items.length]);

  if (items.length === 0) return null;
  if (items.length === 1) {
    return <div className={cn("inline-flex items-center", className)}>{items[0]}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-wrap items-center",
        wrapped ? "gap-1.5" : "gap-0",
        className,
      )}
    >
      {items.map((child, i) => {
        const isFirst = i === 0;
        const isLast = i === items.length - 1;
        const extra = wrapped
          ? ""
          : cn(!isFirst && "rounded-l-none -ml-px", !isLast && "rounded-r-none");
        const existing = (child.props as any)?.className as string | undefined;
        return React.cloneElement(child, {
          key: child.key ?? i,
          className: cn(existing, extra),
        } as any);
      })}
    </div>
  );
}
