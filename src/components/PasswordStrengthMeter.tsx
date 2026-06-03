import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";

// scorePassword: awards 1 point each for ≥8 chars, ≥12 chars, mixed case,
// a digit, and a symbol. Capped at 4 to match the four visual segments.
export function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

// Index 0 = empty (muted track); indices 1-4 map to score 1-4 (weak → strong).
const COLORS = [
  "bg-muted",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-[var(--color-accent)]",
];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { t } = useI18n();
  const score = useMemo(() => scorePassword(password), [password]);
  const labels = [
    t("password.tooShort"),
    t("password.weak"),
    t("password.fair"),
    t("password.good"),
    t("password.strong"),
  ];
  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {/* Four equal segments — filled up to `score` using the color for that score. */}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < score ? COLORS[score] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{labels[score]}</p>
    </div>
  );
}
