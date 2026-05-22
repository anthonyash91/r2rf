import { forwardRef, type ElementType, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  padded?: boolean;
};

/**
 * Standard surface wrapper used across the admin UI.
 * Encapsulates `rounded-2xl border border-border bg-card` plus default padding.
 *
 * - `as` lets callers swap the rendered element (default `section`).
 * - `padded={false}` drops the default `p-6` (use for tables / overflow surfaces).
 */
export const SectionCard = forwardRef<HTMLElement, SectionCardProps>(
  ({ as: Tag = "section", padded = true, className, ...rest }, ref) => {
    return (
      <Tag
        ref={ref}
        className={cn(
          "rounded-2xl border border-border bg-card",
          padded && "p-6",
          className,
        )}
        {...rest}
      />
    );
  },
);
SectionCard.displayName = "SectionCard";
