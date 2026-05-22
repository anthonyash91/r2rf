import * as React from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Variant = "default" | "destructive";

const VARIANT_CLASSES: Record<Variant, string> = {
  default:
    "border-input bg-background hover:bg-muted text-foreground",
  destructive:
    "border-destructive/30 text-destructive hover:bg-destructive/10",
};

const BASE_CLASSES =
  "inline-flex items-center justify-center h-9 w-9 rounded-xl border transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

/**
 * Compose the standard icon-button classes. Useful when rendering a
 * non-button element (e.g. <Link>) that should look like an IconButton.
 */
export function iconButtonClassName(
  variant: Variant = "default",
  className?: string,
) {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], className);
}

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Lucide icon component to render. Swapped for a spinner when `pending`. */
  icon: LucideIcon;
  /** Optional tooltip label. If provided, the button is wrapped in a Tooltip. */
  tooltip?: React.ReactNode;
  /** Tooltip label shown while pending. Defaults to "Saving…". */
  pendingTooltip?: React.ReactNode;
  /** Whether the underlying action is in flight. Disables the button and shows a spinner. */
  pending?: boolean;
  variant?: Variant;
  /** aria-label is required — icon-only buttons must have an accessible name. */
  "aria-label": string;
}

/**
 * Square 36×36 icon-only action button used throughout admin tables/lists.
 * - Pass `pending` to swap the icon for a spinner and disable the button.
 * - Pass `tooltip` to wrap with Radix Tooltip (parent must provide TooltipProvider).
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon: Icon,
      tooltip,
      pendingTooltip = "Saving…",
      pending = false,
      variant = "default",
      className,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) {
    const button = (
      <button
        ref={ref}
        type={type}
        disabled={disabled || pending}
        className={iconButtonClassName(variant, className)}
        {...props}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </button>
    );
    if (!tooltip) return button;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{pending ? pendingTooltip : tooltip}</TooltipContent>
      </Tooltip>
    );
  },
);

/**
 * Wrap any element (e.g. a <Link>) with a Tooltip. The child must accept a
 * ref (use `asChild`-compatible components or forwardRef'd elements).
 */
export function TooltipWrap({
  tooltip,
  children,
}: {
  tooltip: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
