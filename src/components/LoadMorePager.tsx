import { useState } from "react";
import { LoadingButton } from "@/components/LoadingButton";

/**
 * State + helpers for the "Show 10 more / Show all / Collapse" pattern.
 */
export function useLoadMore(initial = 10, step = 10) {
  const [visibleCount, setVisibleCount] = useState(initial);
  return {
    visibleCount,
    setVisibleCount,
    showMore: () => setVisibleCount((n) => n + step),
    showAll: (total: number) => setVisibleCount(total),
    collapse: () => setVisibleCount(initial),
    reset: () => setVisibleCount(initial),
    initial,
    step,
  };
}

export type UseLoadMoreReturn = ReturnType<typeof useLoadMore>;

/**
 * Standard tri-button pager: "Showing N of M  • Show 10 more  Show all  Collapse".
 * Renders nothing when total <= initial (nothing to page through).
 */
export function LoadMorePager({
  pager,
  total,
  itemLabel = "item",
  itemLabelPlural,
}: {
  pager: UseLoadMoreReturn;
  total: number;
  itemLabel?: string;
  itemLabelPlural?: string;
}) {
  if (total <= pager.initial) return null;

  const visible = Math.min(pager.visibleCount, total);
  const remaining = Math.max(0, total - visible);
  const plural = itemLabelPlural ?? `${itemLabel}s`;
  const noun = total === 1 ? itemLabel : plural;

  return (
    <div className="mt-3 flex items-center justify-between gap-3 flex-wrap text-sm">
      <span className="text-muted-foreground">
        Showing {visible} of {total} {noun}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {remaining > 0 && (
          <>
            <LoadingButton variant="secondary" onClick={pager.showMore}>
              Show {Math.min(pager.step, remaining)} more
            </LoadingButton>
            <LoadingButton variant="secondary" onClick={() => pager.showAll(total)}>
              Show all
            </LoadingButton>
          </>
        )}
        {visible > pager.initial && (
          <LoadingButton variant="secondary" onClick={pager.collapse}>
            Collapse
          </LoadingButton>
        )}
      </div>
    </div>
  );
}
