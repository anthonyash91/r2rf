import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "group peer relative inline-grid place-content-center h-[18px] w-[18px] shrink-0 rounded-[5px]",
      "border-2 border-border bg-background transition-all duration-150 cursor-pointer",
      "hover:border-[var(--color-accent)] hover:bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-[var(--color-accent)] data-[state=checked]:border-[var(--color-accent)] data-[state=checked]:text-[var(--color-accent-foreground)]",
      "data-[state=indeterminate]:bg-[var(--color-accent)] data-[state=indeterminate]:border-[var(--color-accent)] data-[state=indeterminate]:text-[var(--color-accent-foreground)]",
      className,

    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
      {props.checked === "indeterminate" ? (
        <Minus className="h-3 w-3 stroke-[3]" />
      ) : (
        <Check className="h-3 w-3 stroke-[3]" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
