import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingButton } from "@/components/LoadingButton";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<Size, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: Size;
  /** When provided, the body is wrapped in a <form> that calls onSubmit and renders default footer buttons. */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  /** Disable the submit button (e.g. invalid input). Pending automatically disables it too. */
  submitDisabled?: boolean;
  /** Replace the default footer entirely. */
  footer?: React.ReactNode;
  /** Hide the close (X) icon in the top-right. */
  hideClose?: boolean;
  /** Extra classes for the DialogContent. */
  contentClassName?: string;
  children: React.ReactNode;
}

/**
 * Standardized modal: handles the repeated header/description/footer markup
 * and the project's tightened top-padding (`pt-[18px]`). Pass `onSubmit`
 * for form modals; omit it for picker/info dialogs and supply your own footer.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  pending = false,
  pendingLabel,
  submitDisabled = false,
  footer,
  hideClose = false,
  contentClassName,
  children,
}: FormDialogProps) {
  const body = (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-4">{children}</div>
      {footer !== undefined ? (
        footer
      ) : onSubmit ? (
        <DialogFooter className="gap-2">
          <LoadingButton
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </LoadingButton>
          <LoadingButton
            type="submit"
            pending={pending}
            pendingText={pendingLabel}
            disabled={submitDisabled}
          >
            {submitLabel}
          </LoadingButton>
        </DialogFooter>
      ) : null}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(SIZE_CLASS[size], "pt-[18px]", contentClassName)}
        showClose={!hideClose}
      >
        {onSubmit ? (
          <form onSubmit={onSubmit} className="space-y-4">
            {body}
          </form>
        ) : (
          body
        )}
      </DialogContent>
    </Dialog>
  );
}
