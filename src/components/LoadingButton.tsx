import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
  secondary:
    "border border-input bg-background text-foreground hover:bg-muted disabled:opacity-60",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60",
  ghost:
    "text-foreground hover:bg-muted disabled:opacity-60",
};

export interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether the action is in flight. Shows spinner + pendingText and disables the button. */
  pending?: boolean;
  /** Text to show while pending. Defaults to "Saving…". */
  pendingText?: string;
  /** Optional icon shown to the left of children when NOT pending. */
  icon?: React.ReactNode;
  variant?: Variant;
}

/**
 * Button that automatically shows a spinner + "Saving…" while an async action
 * is in flight. Pass `pending` (typically `mutation.isPending`) to activate it.
 */
export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  function LoadingButton(
    {
      pending = false,
      pendingText = "Saving…",
      icon,
      variant = "primary",
      className,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || pending}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
          VARIANT_CLASSES[variant],
          className,
        )}
        {...props}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {pendingText}
          </>
        ) : (
          <>
            {icon}
            {children}
          </>
        )}
      </button>
    );
  },
);
