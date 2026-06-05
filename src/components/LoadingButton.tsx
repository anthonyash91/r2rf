import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActionButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed";

const VARIANT_CLASSES: Record<ActionButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
  secondary:
    "border border-input bg-background text-foreground hover:bg-muted disabled:opacity-60",
  destructive:
    "border text-[oklch(0.55_0.15_25)] bg-[color-mix(in_oklab,oklch(0.55_0.15_25)_12%,transparent)] border-[color-mix(in_oklab,oklch(0.55_0.15_25)_25%,transparent)] hover:bg-[color-mix(in_oklab,oklch(0.55_0.15_25)_20%,transparent)] disabled:opacity-60",
  ghost:
    "text-foreground hover:bg-muted disabled:opacity-60",
};

/**
 * Returns the shared button class string for the given variant.
 * Use on <Link>, <a>, or other non-button elements that need to match
 * the LoadingButton style.
 */
export function actionButtonClassName(
  variant: ActionButtonVariant = "primary",
  extra?: string,
) {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], extra);
}

export interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Whether the action is in flight. Shows spinner + pendingText and disables the button. */
  pending?: boolean;
  /** Text to show while pending. Defaults to "Saving…". */
  pendingText?: string;
  /** Optional icon shown to the left of children when NOT pending. */
  icon?: React.ReactNode;
  variant?: ActionButtonVariant;
}

/**
 * Standard action button. When `pending` is true, swaps the content for a
 * spinner + `pendingText` and disables itself. Use for all primary/secondary/
 * destructive/ghost rectangular buttons in the app.
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
        className={actionButtonClassName(variant, className)}
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
