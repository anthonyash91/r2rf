import * as React from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Delete, ArrowBigUp, CornerDownLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible on-screen keyboard for forms (sign-in, sign-up, reset password).
 *
 * Usage:
 *   1. Wrap the page in <OnScreenKeyboardProvider>.
 *   2. Spread {...useKeyboardInput(value, setValue)} onto each <input> / <textarea>.
 *      That suppresses the native virtual keyboard (inputMode="none") and routes
 *      key presses from the on-screen keyboard into the controlled value.
 */

type Target = {
  el: HTMLInputElement | HTMLTextAreaElement;
  getValue: () => string;
  setValue: (v: string) => void;
  type: string;
};

type Ctx = {
  register: (t: Target) => void;
  unregister: (el: HTMLElement) => void;
};

const KeyboardCtx = createContext<Ctx | null>(null);

const LETTER_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const SYMBOL_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"'],
  [".", ",", "?", "!", "'", "_", "#", "*"],
];

export function OnScreenKeyboardProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [shift, setShift] = useState(false);
  const [layout, setLayout] = useState<"letters" | "symbols">("letters");
  const [hidden, setHidden] = useState(false);

  const ctx = useMemo<Ctx>(
    () => ({
      register: (t) => {
        setTarget(t);
        setHidden(false);
      },
      unregister: (el) => {
        setTarget((cur) => (cur && cur.el === el ? null : cur));
      },
    }),
    [],
  );

  function press(key: string) {
    if (!target) return;
    const el = target.el;
    const cur = target.getValue();
    if (key === "BACK") {
      target.setValue(cur.slice(0, -1));
    } else if (key === "SPACE") {
      target.setValue(cur + " ");
    } else if (key === "ENTER") {
      const form = el.closest("form");
      form?.requestSubmit();
      return;
    } else if (key === "SHIFT") {
      setShift((s) => !s);
      return;
    } else if (key === "LAYOUT") {
      setLayout((l) => (l === "letters" ? "symbols" : "letters"));
      return;
    } else {
      const ch = layout === "letters" && shift ? key.toUpperCase() : key;
      target.setValue(cur + ch);
      if (shift) setShift(false);
    }
    // keep focus on the input
    requestAnimationFrame(() => el.focus());
  }

  const rows = layout === "letters" ? LETTER_ROWS : SYMBOL_ROWS;
  const show = target !== null && !hidden;

  return (
    <KeyboardCtx.Provider value={ctx}>
      {children}
      {show && (
        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur px-3 py-3 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)]"
          // Prevent button mousedown from blurring the input
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">On-screen keyboard</span>
              <button
                type="button"
                onClick={() => setHidden(true)}
                aria-label="Hide keyboard"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {rows.map((row, i) => (
              <div key={i} className="flex justify-center gap-1.5">
                {i === rows.length - 1 && layout === "letters" && (
                  <Key
                    onPress={() => press("SHIFT")}
                    wide
                    active={shift}
                    ariaLabel="Shift"
                  >
                    <ArrowBigUp className="h-4 w-4" />
                  </Key>
                )}
                {row.map((k) => (
                  <Key key={k} onPress={() => press(k)}>
                    {layout === "letters" && shift ? k.toUpperCase() : k}
                  </Key>
                ))}
                {i === rows.length - 1 && (
                  <Key onPress={() => press("BACK")} wide ariaLabel="Backspace">
                    <Delete className="h-4 w-4" />
                  </Key>
                )}
              </div>
            ))}

            <div className="flex justify-center gap-1.5">
              <Key onPress={() => press("LAYOUT")} wide>
                {layout === "letters" ? "123" : "ABC"}
              </Key>
              <Key onPress={() => press("SPACE")} className="flex-1 max-w-sm" ariaLabel="Space">
                <span className="text-xs text-muted-foreground">space</span>
              </Key>
              <Key onPress={() => press("ENTER")} wide ariaLabel="Enter">
                <CornerDownLeft className="h-4 w-4" />
              </Key>
            </div>
          </div>
        </div>
      )}
    </KeyboardCtx.Provider>
  );
}

function Key({
  children,
  onPress,
  wide,
  active,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  wide?: boolean;
  active?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onPress}
      className={cn(
        "inline-flex h-10 min-w-[2.25rem] items-center justify-center rounded-md border border-border bg-background text-sm font-medium shadow-sm transition-colors hover:bg-muted active:bg-muted/80 select-none",
        wide && "px-3 min-w-[3rem]",
        active && "bg-accent text-accent-foreground border-accent hover:bg-accent/90",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Spread the returned props onto a controlled <input> / <textarea> to route
 * on-screen keyboard presses into its value and suppress the native virtual
 * keyboard on touch devices.
 */
export function useKeyboardInput(value: string, onChange: (v: string) => void) {
  const ctx = useContext(KeyboardCtx);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    return () => {
      if (ref.current && ctx) ctx.unregister(ref.current);
    };
  }, [ctx]);

  return {
    ref: ref as React.RefObject<any>,
    inputMode: "none" as const,
    onFocus: () => {
      if (!ref.current || !ctx) return;
      ctx.register({
        el: ref.current,
        getValue: () => valueRef.current,
        setValue: (v) => onChangeRef.current(v),
        type: (ref.current as HTMLInputElement).type ?? "text",
      });
    },
  };
}
