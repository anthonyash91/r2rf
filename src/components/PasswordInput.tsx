import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Extra classes for the wrapping container. */
  wrapperClassName?: string;
};

/**
 * Password input with a built-in eye toggle that reveals/hides the value.
 * Forwards ref and arbitrary props to the underlying <input>, so it can be
 * used as a drop-in replacement for `<input type="password" />` and is
 * compatible with `useKeyboardInput()` (spread the returned props directly).
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, Props>(
  ({ className, wrapperClassName, ...rest }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className={cn("relative", wrapperClassName)}>
        <input
          {...rest}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(className, "pr-10")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
