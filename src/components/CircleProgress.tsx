import { Check } from "lucide-react";

export function CircleProgress({
  value,
  size = 56,
  stroke = 5,
  className = "",
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  // r: radius inset by half the stroke width so the ring doesn't clip the SVG edge.
  // c: full circumference. offset: how much of the ring is "empty" (undrawn).
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const offset = c - (pct / 100) * c;
  const complete = pct === 100;
  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      {/* SVG is rotated -90° so the ring starts at 12 o'clock instead of 3 o'clock. */}
      <svg width={size} height={size} className="-rotate-90">
        {/* Track ring — always full circle at 15% accent opacity. */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "color-mix(in oklab, var(--color-accent) 15%, transparent)" }} />
        {/* Progress ring — dashoffset drives how much of the circumference is visible. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {/* At 100% swap the percentage text for a checkmark sized at 38% of the ring diameter. */}
        {complete ? (
          <Check
            className="text-[var(--color-accent)]"
            strokeWidth={2.5}
            style={{ width: size * 0.38, height: size * 0.38 }}
          />
        ) : (
          <span className="text-xs font-semibold tabular-nums">{pct}%</span>
        )}
      </div>
    </div>
  );
}
