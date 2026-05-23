// Centralized color styling for content "Type" badges across the app.
// Each known type has a unique palette that harmonizes with the
// Emerald Prestige theme. Unknown/custom types are hashed to a
// SEPARATE pool of palettes so they never collide with the colors
// already reserved for known types.

// Each palette uses a single base color with 15% tinted bg, 30% tinted
// border, and the full color for text — same pattern as CategoryIcon.
const PALETTES = [
  // 0 emerald
  "bg-[oklch(0.48_0.09_165)]/15 text-[oklch(0.48_0.09_165)] border-[oklch(0.48_0.09_165)]/30",
  // 1 gold
  "bg-[oklch(0.52_0.10_85)]/15 text-[oklch(0.52_0.10_85)] border-[oklch(0.52_0.10_85)]/30",
  // 2 teal
  "bg-[oklch(0.46_0.08_210)]/15 text-[oklch(0.46_0.08_210)] border-[oklch(0.46_0.08_210)]/30",
  // 3 terracotta
  "bg-[oklch(0.50_0.10_40)]/15 text-[oklch(0.50_0.10_40)] border-[oklch(0.50_0.10_40)]/30",
  // 4 plum
  "bg-[oklch(0.48_0.10_330)]/15 text-[oklch(0.48_0.10_330)] border-[oklch(0.48_0.10_330)]/30",
  // 5 moss
  "bg-[oklch(0.46_0.08_140)]/15 text-[oklch(0.46_0.08_140)] border-[oklch(0.46_0.08_140)]/30",
  // 6 indigo
  "bg-[oklch(0.44_0.10_280)]/15 text-[oklch(0.44_0.10_280)] border-[oklch(0.44_0.10_280)]/30",
  // 7 rose
  "bg-[oklch(0.50_0.11_15)]/15 text-[oklch(0.50_0.11_15)] border-[oklch(0.50_0.11_15)]/30",
  // 8 slate
  "bg-[oklch(0.45_0.04_250)]/15 text-[oklch(0.45_0.04_250)] border-[oklch(0.45_0.04_250)]/30",
  // --- fallback-only palettes (never assigned to a known type) ---
  // 9 amber
  "bg-[oklch(0.50_0.10_70)]/15 text-[oklch(0.50_0.10_70)] border-[oklch(0.50_0.10_70)]/30",
  // 10 cyan
  "bg-[oklch(0.46_0.08_195)]/15 text-[oklch(0.46_0.08_195)] border-[oklch(0.46_0.08_195)]/30",
  // 11 violet
  "bg-[oklch(0.46_0.12_295)]/15 text-[oklch(0.46_0.12_295)] border-[oklch(0.46_0.12_295)]/30",
  // 12 olive
  "bg-[oklch(0.48_0.08_110)]/15 text-[oklch(0.48_0.08_110)] border-[oklch(0.48_0.08_110)]/30",
  // 13 fuchsia
  "bg-[oklch(0.50_0.10_350)]/15 text-[oklch(0.50_0.10_350)] border-[oklch(0.50_0.10_350)]/30",
  // 14 stone
  "bg-[oklch(0.45_0.04_70)]/15 text-[oklch(0.45_0.04_70)] border-[oklch(0.45_0.04_70)]/30",
];

// Explicit assignments for common/known types so each gets a unique color
// (case-insensitive). Anything not listed is hashed across FALLBACK_INDICES.
const KNOWN: Record<string, number> = {
  article: 0,
  podcast: 1,
  worksheet: 2,
  video: 3,
  guide: 4,
  meeting: 5,
  audio: 6,
  pdf: 7,
  link: 8,
};

// Palettes available for unknown/custom types — strictly disjoint from
// any index used in KNOWN, so a hashed badge can never duplicate a
// known type's color.
const RESERVED = new Set(Object.values(KNOWN));
const FALLBACK_INDICES = PALETTES.map((_, i) => i).filter((i) => !RESERVED.has(i));

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function typeBadgeClass(type: string | null | undefined): string {
  const key = (type ?? "").trim().toLowerCase();
  let idx: number;
  if (key in KNOWN) {
    idx = KNOWN[key];
  } else if (FALLBACK_INDICES.length > 0) {
    idx = FALLBACK_INDICES[hash(key) % FALLBACK_INDICES.length];
  } else {
    idx = hash(key) % PALETTES.length;
  }
  return `border ${PALETTES[idx]}`;
}
