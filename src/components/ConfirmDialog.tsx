import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * Optional async action to run when the user confirms. If provided, the
   * dialog stays open with a spinner + "<pendingLabel>…" until the promise
   * settles, then closes. The outer `await confirm(...)` resolves to `true`
   * on success and `false` if the action throws (the caller's mutation will
   * typically surface the error via toast).
   */
  onConfirm?: () => Promise<unknown> | unknown;
  /** Label shown on the action button while `onConfirm` is running. Defaults to "Deleting" if destructive, else "Saving". */
  pendingLabel?: string;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({});
  const [pending, setPending] = useState(false);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    setPending(false);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    setOpen(false);
    setPending(false);
    resolverRef.current?.(value);
    resolverRef.current = null;
  };

  const handleConfirm = async () => {
    if (!opts.onConfirm) {
      settle(true);
      return;
    }
    try {
      setPending(true);
      await opts.onConfirm();
      settle(true);
    } catch {
      // Caller's mutation onError typically toasts the message.
      settle(false);
    }
  };

  const pendingLabel =
    opts.pendingLabel ?? (opts.destructive ? "Deleting" : "Saving");

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (pending) return; // lock dialog while action is running
          if (!o) settle(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts.title ?? "Are you sure?"}</AlertDialogTitle>
            {opts.description && (
              <AlertDialogDescription>{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => {
                if (pending) {
                  e.preventDefault();
                  return;
                }
                settle(false);
              }}
              disabled={pending}
              className="shadow-none"
            >
              {opts.cancelLabel ?? "Cancel"}
            </AlertDialogCancel>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className={cn(
                buttonVariants({ variant: opts.destructive ? "destructive" : "default" }),
                "shadow-none inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed",
              )}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? `${pendingLabel}…` : opts.confirmLabel ?? "Confirm"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmDialogProvider");
  return ctx;
}
