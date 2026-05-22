import type { ReactNode } from "react";
import { useConfirm } from "@/components/ConfirmDialog";

type DeleteConfirmOptions = {
  title: string;
  description?: ReactNode;
  /** Defaults to "Delete". */
  confirmLabel?: string;
  /** Defaults to "Deleting" (from ConfirmDialog). */
  pendingLabel?: string;
  onConfirm: () => Promise<unknown> | unknown;
};

/**
 * Thin wrapper over useConfirm() that defaults destructive=true and
 * confirmLabel="Delete". Shrinks per-row delete handlers from ~6 lines
 * to a single call while still allowing label overrides ("Remove",
 * "Unblock", "Reset", etc.).
 */
export function useConfirmDelete() {
  const confirm = useConfirm();
  return (opts: DeleteConfirmOptions) =>
    confirm({
      destructive: true,
      confirmLabel: opts.confirmLabel ?? "Delete",
      ...opts,
    });
}
