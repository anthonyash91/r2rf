// Centralized color styling for content "Type" badges across the app.
// Each known type has a unique palette that harmonizes with the
// Emerald Prestige theme. Unknown/custom types are hashed to one of
// the same palettes so styling stays consistent everywhere.

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
];

// Explicit assignments for common types so each gets a unique color
// (case-insensitive). Anything not listed is hashed across PALETTES.
const KNOWN: Record<string, number> = {
  article: 0,
  video: 3,
  podcast: 1,
  worksheet: 2,
  meeting: 5,
  guide: 4,
  pdf: 2,
  audio: 6,
  link: 8,
  image: 7,
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function typeBadgeClass(type: string | null | undefined): string {
  const key = (type ?? "").trim().toLowerCase();
  const idx = key in KNOWN ? KNOWN[key] : hash(key) % PALETTES.length;
  return `border ${PALETTES[idx]}`;
}
