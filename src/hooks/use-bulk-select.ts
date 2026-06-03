import { useCallback, useState } from "react";

/**
 * Shared state for admin list pages with an "Edit mode → multi-select → bulk delete" flow.
 *
 * Returns the selection set, edit-mode flag, isDeleting flag (for the bulk
 * action button), and helpers to toggle selection / enter / exit edit mode.
 */
export function useBulkSelect() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [editMode, setEditMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const enterEditMode = useCallback(() => setEditMode(true), []);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setSelectedIds(new Set());
  }, []);

  /**
   * Run a bulk delete with the standard isDeleting lifecycle. The runner
   * receives the selected ids and should return `true` if the action succeeded
   * (in which case edit mode is exited automatically).
   */
  const runBulkDelete = useCallback(
    async (run: (ids: string[]) => Promise<boolean>) => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      setIsDeleting(true);
      try {
        const ok = await run(ids);
        // Only exit edit mode on success; leave it open so the user can retry
        // or make a different selection if the delete partially failed.
        if (ok) {
          setEditMode(false);
          setSelectedIds(new Set());
        }
      } finally {
        // Always clear the spinner regardless of success or failure.
        setIsDeleting(false);
      }
    },
    // Re-create when selectedIds changes so the snapshot captured by `ids`
    // inside the callback is always current at the time of the click.
    [selectedIds],
  );

  return {
    selectedIds,
    setSelectedIds,
    editMode,
    setEditMode,
    isDeleting,
    selectedCount: selectedIds.size,
    has: (id: string) => selectedIds.has(id),
    toggle,
    clear,
    enterEditMode,
    exitEditMode,
    runBulkDelete,
  };
}

export type UseBulkSelectReturn = ReturnType<typeof useBulkSelect>;
