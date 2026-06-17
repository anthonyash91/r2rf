import * as React from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Delete, ArrowBigUp, CornerDownLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/**
 * Accessible on-screen keyboard for forms (sign-in, sign-up, reset password).
 * Only renders on mobile devices (coarse pointer + narrow viewport).
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
  isMobile: boolean;
};

const KeyboardCtx = createContext<Ctx | null>(null);

const LETTER_ROWS_EN = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const SYMBOL_ROWS_EN = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["-", "/", ":", ";", "(", ")", "$", "&", "@", '"'],
  [".", ",", "?", "!", "'", "_", "#", "*"],
];

// Spanish QWERTY adds ñ to the second letter row and replaces the middle
// symbol row with accented vowels and inverted punctuation.
const LETTER_ROWS_ES = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ñ"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const SYMBOL_ROWS_ES = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["á", "é", "í", "ó", "ú", "ü", "¿", "¡", "@", '"'],
  [".", ",", "?", "!", "'", "_", "#", "*"],
];

const HIGHLIGHT_CLASSES = [
  "ring-2",
  "ring-[var(--color-accent)]",
  "ring-offset-2",
  "ring-offset-background",
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(pointer: coarse) and (max-width: 900px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);
  return isMobile;
}

export function OnScreenKeyboardProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const { lang, t } = useI18n();
  const [target, setTarget] = useState<Target | null>(null);
  const [shift, setShift] = useState(false);
  const [layout, setLayout] = useState<"letters" | "symbols">("letters");
  const [hidden, setHidden] = useState(false);
  const keyboardRef = useRef<HTMLDivElement>(null);

  const show = isMobile && target !== null && !hidden;

  // Close keyboard on browser back/forward navigation.
  useEffect(() => {
    const handlePop = () => setTarget(null);
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  // Apply / clear focus highlight on the active input.
  useEffect(() => {
    if (!target) return;
    const el = target.el;
    el.classList.add(...HIGHLIGHT_CLASSES);
    return () => {
      el.classList.remove(...HIGHLIGHT_CLASSES);
    };
  }, [target]);

  // Disable overscroll-bounce while the keyboard is visible so iOS doesn't
  // rubber-band-scroll the fixed keyboard away from the bottom of the screen.
  useEffect(() => {
    if (!show) return;
    document.body.style.overscrollBehaviorY = "none";
    return () => { document.body.style.overscrollBehaviorY = ""; };
  }, [show]);

  // Pad the page bottom so content hidden behind the keyboard can be scrolled
  // into view — but only on short pages. On long pages iOS miscalculates the
  // position of fixed elements when body paddingBottom is set, making the
  // keyboard appear to scroll with the page.
  useEffect(() => {
    if (!show || !keyboardRef.current) return;
    const el = keyboardRef.current;
    const apply = () => {
      if (!el) return;
      const kbHeight = el.offsetHeight;
      // Reset first so scrollHeight reflects the natural document height.
      document.body.style.paddingBottom = "";
      const naturalHeight = document.documentElement.scrollHeight;
      if (naturalHeight < window.innerHeight + kbHeight) {
        document.body.style.paddingBottom = `${kbHeight}px`;
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.body.style.paddingBottom = "";
    };
  }, [show]);

  // When the keyboard opens or the target changes, scroll the page just enough
  // to bring the active input above the keyboard.
  useEffect(() => {
    if (!show || !target) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!keyboardRef.current || !target) return;
        const rect = target.el.getBoundingClientRect();
        const kbHeight = keyboardRef.current.offsetHeight;
        const clearance = 12; // px gap between input bottom and keyboard top
        const visibleBottom = window.innerHeight - kbHeight - clearance;
        if (rect.bottom > visibleBottom) {
          window.scrollBy({ top: rect.bottom - visibleBottom, behavior: "smooth" });
        }
      });
    });
    return () => cancelAnimationFrame(id);
  }, [show, target]);

  const ctx = useMemo<Ctx>(
    () => ({
      register: (t) => {
        setTarget(t);
        setHidden(false);
      },
      unregister: (el) => {
        setTarget((cur) => (cur && cur.el === el ? null : cur));
      },
      isMobile,
    }),
    [isMobile],
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
      const ch = shift ? key.toUpperCase() : key;
      target.setValue(cur + ch);
      if (shift) setShift(false);
    }
    requestAnimationFrame(() => el.focus());
  }

  const letterRows = lang === "es" ? LETTER_ROWS_ES : LETTER_ROWS_EN;
  const symbolRows = lang === "es" ? SYMBOL_ROWS_ES : SYMBOL_ROWS_EN;
  const rows: string[][] = layout === "letters" ? letterRows : symbolRows;

  return (
    <KeyboardCtx.Provider value={ctx}>
      {children}
      {show &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={keyboardRef}
            className="fixed inset-x-0 bottom-0 z-[1000] border-t border-border bg-card px-2 pt-2 shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)]"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.5rem)",
              transform: "translateZ(0)",
              willChange: "transform",
            }}
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onTouchStart={(e) => e.preventDefault()}
          >
            <div className="mx-auto flex w-full max-w-[760px] flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">{t("osk.label")}</span>
                <button
                  type="button"
                  onClick={() => setHidden(true)}
                  aria-label="Hide keyboard"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {rows.map((row, i) => (
                <div key={i} className="flex w-full justify-center gap-1">
                  {i === rows.length - 1 && (layout === "letters" || lang === "es") && (
                    <Key
                      onPress={() => press("SHIFT")}
                      flexBasis={1.5}
                      active={shift}
                      ariaLabel="Shift"
                    >
                      <ArrowBigUp className="h-5 w-5" />
                    </Key>
                  )}
                  {row.map((k) => (
                    <Key key={k} onPress={() => press(k)} flexBasis={1}>
                      {shift ? k.toUpperCase() : k}
                    </Key>
                  ))}
                  {i === rows.length - 1 && (
                    <Key onPress={() => press("BACK")} flexBasis={1.5} ariaLabel="Backspace">
                      <Delete className="h-5 w-5" />
                    </Key>
                  )}
                </div>
              ))}

              <div className="flex w-full justify-center gap-1">
                <Key onPress={() => press("LAYOUT")} flexBasis={1.5}>
                  {layout === "letters" ? "123" : "ABC"}
                </Key>
                <Key onPress={() => press("SPACE")} flexBasis={5} ariaLabel="Space">
                  <span className="text-xs text-muted-foreground">space</span>
                </Key>
                <Key onPress={() => press("ENTER")} flexBasis={1.5} ariaLabel="Enter">
                  <CornerDownLeft className="h-5 w-5" />
                </Key>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </KeyboardCtx.Provider>
  );
}

function Key({
  children,
  onPress,
  flexBasis = 1,
  active,
  className,
  ariaLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  flexBasis?: number;
  active?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onPress}
      style={{ flex: `${flexBasis} 1 0`, minWidth: 0 }}
      className={cn(
        "inline-flex h-12 sm:h-14 items-center justify-center rounded-md border border-border bg-background text-base font-medium shadow-sm transition-colors hover:bg-muted active:bg-muted/80 select-none",
        active && "bg-accent text-accent-foreground border-accent hover:bg-accent/90",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Spread the returned props onto a controlled <input> / <textarea>. On mobile
 * this suppresses the native virtual keyboard and routes presses from the
 * on-screen keyboard into the controlled value. On desktop it's a no-op so
 * physical keyboard typing works normally.
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

  if (!ctx?.isMobile) {
    return { ref: ref as React.RefObject<any> };
  }

  const doRegister = () => {
    if (!ref.current || !ctx) return;
    ctx.register({
      el: ref.current,
      getValue: () => valueRef.current,
      setValue: (v) => onChangeRef.current(v),
      type: (ref.current as HTMLInputElement).type ?? "text",
    });
  };

  return {
    ref: ref as React.RefObject<any>,
    inputMode: "none" as const,
    onFocus: doRegister,
    onClick: doRegister,
    onPointerDown: doRegister,
    onTouchStart: doRegister,
  };
}
