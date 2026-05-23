// Curated palette of 15 oklch color combos used for all badges and the
// category icon default. Each entry produces matching bg/border/text classes
// using the same 15%/30%/full pattern as CategoryIcon and type badges.

export type Palette = {
  /** Human-readable label shown in admin. */
  label: string;
  /** oklch color string (no parens), used as base for css color-mix etc. */
  oklch: string;
};

export const PALETTES: Palette[] = [
  { label: "Emerald", oklch: "oklch(0.48 0.09 165)" },
  { label: "Gold", oklch: "oklch(0.52 0.10 85)" },
  { label: "Teal", oklch: "oklch(0.46 0.08 210)" },
  { label: "Terracotta", oklch: "oklch(0.50 0.10 40)" },
  { label: "Plum", oklch: "oklch(0.48 0.10 330)" },
  { label: "Moss", oklch: "oklch(0.46 0.08 140)" },
  { label: "Indigo", oklch: "oklch(0.44 0.10 280)" },
  { label: "Rose", oklch: "oklch(0.50 0.11 15)" },
  { label: "Slate", oklch: "oklch(0.45 0.04 250)" },
  { label: "Amber", oklch: "oklch(0.50 0.10 70)" },
  { label: "Cyan", oklch: "oklch(0.46 0.08 195)" },
  { label: "Violet", oklch: "oklch(0.46 0.12 295)" },
  { label: "Olive", oklch: "oklch(0.48 0.08 110)" },
  { label: "Fuchsia", oklch: "oklch(0.50 0.10 350)" },
  { label: "Stone", oklch: "oklch(0.45 0.04 70)" },
];

export function paletteClasses(idx: number): string {
  const p = PALETTES[((idx % PALETTES.length) + PALETTES.length) % PALETTES.length];
  return `border bg-[${p.oklch}]/15 text-[${p.oklch}] border-[${p.oklch}]/30`;
}

export function paletteStyle(idx: number): { color: string; bg: string; border: string } {
  const p = PALETTES[((idx % PALETTES.length) + PALETTES.length) % PALETTES.length];
  return {
    color: p.oklch,
    bg: `color-mix(in oklab, ${p.oklch} 15%, transparent)`,
    border: `color-mix(in oklab, ${p.oklch} 30%, transparent)`,
  };
}

// ---------- Variant + type identifiers ----------

export const BADGE_VARIANTS = [
  "new",
  "count",
  "draft",
  "custom",
  "category",
  "translation",
  "admin",
  "contributor",
  "verified",
  "unverified",
  "user",
  "facility",
] as const;
export type BadgeVariantKey = (typeof BADGE_VARIANTS)[number];

export const KNOWN_TYPES = [
  "article",
  "podcast",
  "worksheet",
  "video",
  "guide",
  "meeting",
  "audio",
  "pdf",
  "link",
] as const;
export type KnownTypeKey = (typeof KNOWN_TYPES)[number];

// ---------- Defaults (palette index per identifier) ----------

export const DEFAULT_VARIANT_INDEX: Record<BadgeVariantKey, number> = {
  new: 0, // emerald
  count: 1, // gold
  draft: 8, // slate
  custom: 4, // plum (custom accent feel)
  category: 7, // rose
  translation: 1, // gold
  admin: 6, // indigo
  contributor: 2, // teal
  verified: 5, // moss
  unverified: 9, // amber
  user: 6, // indigo
  facility: 11, // violet
};

export const DEFAULT_TYPE_INDEX: Record<KnownTypeKey, number> = {
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

export const DEFAULT_CATEGORY_INDEX = 0; // emerald, matches --color-accent

export type BadgeStyles = {
  variants: Partial<Record<BadgeVariantKey, number>>;
  types: Partial<Record<KnownTypeKey, number>>;
  categoryDefault: number;
};

export const DEFAULT_BADGE_STYLES: BadgeStyles = {
  variants: { ...DEFAULT_VARIANT_INDEX },
  types: { ...DEFAULT_TYPE_INDEX },
  categoryDefault: DEFAULT_CATEGORY_INDEX,
};

export function mergeBadgeStyles(input: unknown): BadgeStyles {
  const v = (input ?? {}) as Partial<BadgeStyles>;
  return {
    variants: { ...DEFAULT_VARIANT_INDEX, ...(v.variants ?? {}) },
    types: { ...DEFAULT_TYPE_INDEX, ...(v.types ?? {}) },
    categoryDefault:
      typeof v.categoryDefault === "number" ? v.categoryDefault : DEFAULT_CATEGORY_INDEX,
  };
}

// Hash for unknown content types so they still get a stable color.
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function indexForType(type: string | null | undefined, styles: BadgeStyles): number {
  const key = (type ?? "").trim().toLowerCase();
  if (key in styles.types) return styles.types[key as KnownTypeKey] as number;
  // Fall back to a hash across all palettes
  return hashStr(key) % PALETTES.length;
}
