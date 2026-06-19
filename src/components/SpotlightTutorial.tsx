import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type TutorialStep = {
  targetId: string | null;
  Icon: LucideIcon;
  title: string;
  body: string;
  onEnter?: () => void;
};

interface SpotlightTutorialProps {
  steps: TutorialStep[];
  onComplete: () => void;
}

const TIP_W = 320;
const SPOT_PAD = 6;

export function SpotlightTutorial({ steps, onComplete }: SpotlightTutorialProps) {
  const { t } = useI18n();
  const [stepIdx, setStepIdx] = useState(0);
  const [meas, setMeas] = useState<{ rect: DOMRect; vw: number; vh: number } | null>(null);

  const { Icon, title, body, targetId } = steps[stepIdx];
  const total = steps.length;
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === total - 1;

  const advance = () => {
    if (isLast) onComplete();
    else setStepIdx((s) => s + 1);
  };

  useEffect(() => {
    // Fire the optional side-effect first (tab switch, accordion open, etc.)
    steps[stepIdx]?.onEnter?.();

    setMeas(null);
    if (!targetId) return;

    const measure = () => {
      const el = document.getElementById(targetId);
      if (el) setMeas({ rect: el.getBoundingClientRect(), vw: window.innerWidth, vh: window.innerHeight });
    };

    // Give onEnter's state updates time to render before scrolling
    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    const timer = setTimeout(measure, 450);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(timer);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx]);

  let spotStyle: React.CSSProperties | undefined;
  let tipPos: React.CSSProperties = {};
  let arrowLeft = 0;
  let arrowDir: "up" | "down" | null = null;

  if (meas) {
    const { rect, vw, vh } = meas;
    spotStyle = {
      position: "fixed",
      top: rect.top - SPOT_PAD,
      left: rect.left - SPOT_PAD,
      width: rect.width + SPOT_PAD * 2,
      height: rect.height + SPOT_PAD * 2,
      borderRadius: 10,
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.75)",
      outline: "2px solid rgba(255,255,255,0.3)",
      outlineOffset: "1px",
      zIndex: 52,
      pointerEvents: "none",
    };
    const rawLeft = rect.left + rect.width / 2 - TIP_W / 2;
    const clampedLeft = Math.max(8, Math.min(rawLeft, vw - TIP_W - 8));
    const inTopHalf = rect.top + rect.height / 2 < vh * 0.6;
    if (inTopHalf) {
      tipPos = { top: rect.bottom + SPOT_PAD + 12, left: clampedLeft };
      arrowDir = "up";
    } else {
      tipPos = { bottom: vh - rect.top + SPOT_PAD + 12, left: clampedLeft };
      arrowDir = "down";
    }
    arrowLeft = Math.max(16, Math.min(rect.left + rect.width / 2 - clampedLeft, TIP_W - 16));
  } else if (!targetId) {
    tipPos = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  } else {
    return <div className="fixed inset-0 z-[51] bg-black/70 backdrop-blur-sm" />;
  }

  return (
    <>
      {!targetId && <div className="fixed inset-0 z-[51] bg-black/70 backdrop-blur-sm" />}
      {spotStyle && <div style={spotStyle} />}
      <div
        className="fixed z-[60] bg-card border border-border rounded-xl shadow-2xl p-5 flex flex-col gap-4"
        style={{ width: TIP_W, ...tipPos }}
      >
        {arrowDir === "up" && (
          <div
            className="absolute -top-[7px] w-3 h-3 bg-card border-t border-l border-border rotate-45"
            style={{ left: arrowLeft - 6 }}
          />
        )}
        {arrowDir === "down" && (
          <div
            className="absolute -bottom-[7px] w-3 h-3 bg-card border-b border-r border-border rotate-45"
            style={{ left: arrowLeft - 6 }}
          />
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIdx
                    ? "w-6 bg-primary"
                    : i < stepIdx
                    ? "w-1.5 bg-primary/40"
                    : "w-1.5 bg-muted-foreground/25"
                }`}
              />
            ))}
          </div>
          {!isLast && (
            <button
              type="button"
              onClick={onComplete}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("tutorial.skip")}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h2 className="text-sm font-semibold leading-snug">{title}</h2>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>

        <button
          type="button"
          onClick={advance}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {isLast ? t("tutorial.getStarted") : isFirst ? t("tutorial.showMeAround") : t("tutorial.next")}
          {!isLast && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </>
  );
}
