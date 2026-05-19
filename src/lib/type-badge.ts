// Centralized color styling for content "Type" badges across the app.
// Each known type has a unique palette that harmonizes with the
// Emerald Prestige theme. Unknown/custom types are hashed to one of
// the same palettes so styling stays consistent everywhere.

const PALETTES = [
  // emerald
  "bg-[oklch(0.93_0.05_165)] text-[oklch(0.32_0.07_165)] border-[oklch(0.78_0.07_165)]",
  // gold
  "bg-[oklch(0.94_0.07_85)] text-[oklch(0.38_0.09_85)] border-[oklch(0.78_0.12_85)]",
  // teal
  "bg-[oklch(0.92_0.05_200)] text-[oklch(0.35_0.09_220)] border-[oklch(0.72_0.08_210)]",
  // terracotta
  "bg-[oklch(0.92_0.05_45)] text-[oklch(0.42_0.12_40)] border-[oklch(0.75_0.10_45)]",
  // plum
  "bg-[oklch(0.92_0.04_330)] text-[oklch(0.38_0.10_330)] border-[oklch(0.72_0.08_330)]",
  // moss
  "bg-[oklch(0.93_0.05_140)] text-[oklch(0.35_0.09_145)] border-[oklch(0.72_0.08_140)]",
];

const KNOWN: Record<string, number> = {
  Article: 0,
  Video: 3,
  Podcast: 1,
  Worksheet: 2,
  Meeting: 5,
  Guide: 4,
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function typeBadgeClass(type: string | null | undefined): string {
  const key = (type ?? "").trim();
  const idx = key in KNOWN ? KNOWN[key] : hash(key.toLowerCase()) % PALETTES.length;
  return `border ${PALETTES[idx]}`;
}
