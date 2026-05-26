import type { ReactNode } from "react";
import { Pencil, Search, Trash2, X } from "lucide-react";
import type { UseBulkSelectReturn } from "@/hooks/use-bulk-select";
import { LoadingButton } from "@/components/LoadingButton";

interface BulkActionBarProps {
  bulk: UseBulkSelectReturn;
  /** Total rows currently shown (post-filter). */
  filteredCount: number;
  /** Total rows before filtering. Pass when a search query is active to render "X of Y". */
  totalCount?: number;
  /** Whether a search query is currently active. Controls the "X of Y" suffix. */
  isFiltered?: boolean;
  /** Singular / plural noun for the row type (e.g. "facility" / "facilities"). */
  noun: { singular: string; plural: string };

  /** Search input value. Pass `null` to hide the search box. */
  searchQuery?: string | null;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  /**
   * Confirm + perform the bulk delete. Receives the selected ids. Should
   * return `true` on success so the bar can exit edit mode.
   */
  onDeleteSelected: (ids: string[]) => Promise<boolean>;

  /** Optional hook fired when entering edit mode (e.g. close an open editor). */
  onEnterEditMode?: () => void;

  /**
   * Override the "Click X to select for deletion" hint text shown while edit
   * mode is on but nothing is selected.
   */
  emptyEditHint?: string;

  /**
   * Optional extra actions rendered before the destructive delete button
   * when one or more rows are selected. Receives the selected ids.
   */
  extraSelectionActions?: (selectedIds: string[]) => ReactNode;
}

export function BulkActionBar({
  bulk,
  filteredCount,
  totalCount,
  isFiltered = false,
  noun,
  searchQuery = null,
  onSearchChange,
  searchPlaceholder,
  onDeleteSelected,
  onEnterEditMode,
  emptyEditHint,
  extraSelectionActions,
}: BulkActionBarProps) {
  const { editMode, selectedCount, selectedIds, isDeleting, enterEditMode, exitEditMode, runBulkDelete } = bulk;
  const countLabel = filteredCount === 1 ? noun.singular : noun.plural;
  const countText =
    isFiltered && totalCount !== undefined
      ? `${filteredCount} of ${totalCount} ${countLabel}`
      : `${filteredCount} ${countLabel}`;

  return (
    <div className="mt-3 flex min-h-[56px] flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-t-md border border-b-0 border-border bg-muted/40 px-4 sm:px-5 py-3 sm:py-2 text-sm">
      <span className="text-muted-foreground">
        {editMode
          ? selectedCount > 0
            ? `${selectedCount} selected`
            : emptyEditHint ?? `Click ${noun.plural} to select for deletion`
          : countText}
      </span>
      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:ml-auto sm:justify-end">
        {searchQuery !== null && onSearchChange && (
          <div className="relative flex-1 sm:flex-none min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder ?? `Search ${noun.plural}…`}
              className="rounded-md border border-input bg-background pl-8 pr-8 py-2 text-sm w-full sm:w-56"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {!editMode ? (
          <LoadingButton
            variant="secondary"
            onClick={() => {
              onEnterEditMode?.();
              enterEditMode();
            }}
            icon={<Pencil className="h-4 w-4" />}
          >
            Edit
          </LoadingButton>
        ) : (
          <>
            <LoadingButton
              variant="secondary"
              disabled={isDeleting}
              onClick={exitEditMode}
            >
              {selectedCount > 0 ? "Cancel" : "Done"}
            </LoadingButton>
            {selectedCount > 0 && extraSelectionActions?.(Array.from(selectedIds))}
            {(selectedCount > 0 || isDeleting) && (
              <LoadingButton
                variant="destructive"
                pending={isDeleting}
                pendingText="Deleting…"
                onClick={() => runBulkDelete(onDeleteSelected)}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Delete selected ({selectedCount})
              </LoadingButton>
            )}
          </>
        )}
      </div>
    </div>
  );
}
