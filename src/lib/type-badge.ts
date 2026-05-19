// Centralized color styling for content "Type" badges across the app.
// Each known type has a unique palette that harmonizes with the
// Emerald Prestige theme. Unknown/custom types are hashed to a
// SEPARATE pool of palettes so they never collide with the colors
// already reserved for known types.

const PALETTES = [
  // 0 emerald
  "bg-[oklch(0.95_0.02_165)] text-[oklch(0.35_0.05_165)] border-[oklch(0.85_0.03_165)]",
  // 1 gold
  "bg-[oklch(0.95_0.03_85)] text-[oklch(0.42_0.05_85)] border-[oklch(0.85_0.05_85)]",
  // 2 teal
  "bg-[oklch(0.95_0.02_210)] text-[oklch(0.40_0.05_215)] border-[oklch(0.83_0.03_210)]",
  // 3 terracotta
  "bg-[oklch(0.95_0.02_45)] text-[oklch(0.45_0.06_40)] border-[oklch(0.85_0.04_45)]",
  // 4 plum
  "bg-[oklch(0.95_0.02_330)] text-[oklch(0.42_0.05_330)] border-[oklch(0.85_0.03_330)]",
  // 5 moss
  "bg-[oklch(0.95_0.02_140)] text-[oklch(0.38_0.05_145)] border-[oklch(0.83_0.03_140)]",
  // 6 indigo
  "bg-[oklch(0.95_0.02_280)] text-[oklch(0.40_0.06_280)] border-[oklch(0.85_0.03_280)]",
  // 7 rose
  "bg-[oklch(0.95_0.02_15)] text-[oklch(0.45_0.06_15)] border-[oklch(0.85_0.04_15)]",
  // 8 slate
  "bg-[oklch(0.95_0.01_250)] text-[oklch(0.40_0.03_250)] border-[oklch(0.84_0.02_250)]",
  // --- fallback-only palettes (never assigned to a known type) ---
  // 9 amber
  "bg-[oklch(0.95_0.03_70)] text-[oklch(0.43_0.06_70)] border-[oklch(0.85_0.05_70)]",
  // 10 cyan
  "bg-[oklch(0.95_0.02_195)] text-[oklch(0.40_0.05_195)] border-[oklch(0.83_0.03_195)]",
  // 11 violet
  "bg-[oklch(0.95_0.02_305)] text-[oklch(0.42_0.06_305)] border-[oklch(0.85_0.04_305)]",
  // 12 olive
  "bg-[oklch(0.95_0.02_110)] text-[oklch(0.40_0.05_110)] border-[oklch(0.83_0.03_110)]",
  // 13 fuchsia
  "bg-[oklch(0.95_0.02_350)] text-[oklch(0.43_0.06_350)] border-[oklch(0.85_0.04_350)]",
  // 14 stone
  "bg-[oklch(0.94_0.01_70)] text-[oklch(0.40_0.02_70)] border-[oklch(0.83_0.02_70)]",
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
