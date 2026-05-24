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
  { label: "Sage", oklch: "oklch(0.52 0.05 150)" },
  { label: "Coral", oklch: "oklch(0.55 0.12 25)" },
  { label: "Sapphire", oklch: "oklch(0.42 0.11 250)" },
  { label: "Lime", oklch: "oklch(0.55 0.12 130)" },
  { label: "Magenta", oklch: "oklch(0.48 0.13 340)" },
  { label: "Sky", oklch: "oklch(0.52 0.09 230)" },
  { label: "Mustard", oklch: "oklch(0.55 0.10 95)" },
  { label: "Crimson", oklch: "oklch(0.46 0.13 25)" },
  { label: "Mint", oklch: "oklch(0.55 0.07 175)" },
  { label: "Lavender", oklch: "oklch(0.52 0.08 305)" },
  { label: "Rust", oklch: "oklch(0.46 0.11 50)" },
  { label: "Forest", oklch: "oklch(0.40 0.08 155)" },
  { label: "Periwinkle", oklch: "oklch(0.54 0.09 270)" },
  { label: "Burgundy", oklch: "oklch(0.40 0.10 10)" },
  { label: "Aqua", oklch: "oklch(0.50 0.09 200)" },
  { label: "Saffron", oklch: "oklch(0.58 0.12 75)" },
  { label: "Orchid", oklch: "oklch(0.50 0.11 320)" },
  { label: "Pine", oklch: "oklch(0.42 0.07 175)" },
  { label: "Copper", oklch: "oklch(0.52 0.10 55)" },
  { label: "Steel", oklch: "oklch(0.48 0.04 230)" },
  { label: "Cherry", oklch: "oklch(0.50 0.13 5)" },
  { label: "Jade", oklch: "oklch(0.50 0.09 175)" },
  { label: "Iris", oklch: "oklch(0.46 0.11 290)" },
  { label: "Peach", oklch: "oklch(0.60 0.10 45)" },
  { label: "Charcoal", oklch: "oklch(0.42 0.02 260)" },
  { label: "Marigold", oklch: "oklch(0.62 0.13 80)" },
  { label: "Seafoam", oklch: "oklch(0.58 0.07 165)" },
  { label: "Azure", oklch: "oklch(0.48 0.11 245)" },
  { label: "Tangerine", oklch: "oklch(0.60 0.13 55)" },
  { label: "Lilac", oklch: "oklch(0.58 0.08 310)" },
  { label: "Spruce", oklch: "oklch(0.38 0.06 185)" },
  { label: "Wine", oklch: "oklch(0.38 0.11 350)" },
  { label: "Cobalt", oklch: "oklch(0.40 0.13 260)" },
  { label: "Honey", oklch: "oklch(0.60 0.11 90)" },
  { label: "Persimmon", oklch: "oklch(0.54 0.13 35)" },
  { label: "Fern", oklch: "oklch(0.44 0.09 145)" },
  { label: "Oxblood", oklch: "oklch(0.36 0.10 20)" },
  { label: "Pewter", oklch: "oklch(0.52 0.02 250)" },
  { label: "Watermelon", oklch: "oklch(0.56 0.13 10)" },
  { label: "Pistachio", oklch: "oklch(0.62 0.08 130)" },
  { label: "Denim", oklch: "oklch(0.46 0.08 245)" },
  { label: "Apricot", oklch: "oklch(0.62 0.11 60)" },
  { label: "Mulberry", oklch: "oklch(0.42 0.10 340)" },
  { label: "Kelp", oklch: "oklch(0.40 0.07 150)" },
  { label: "Bronze", oklch: "oklch(0.46 0.08 60)" },
  { label: "Glacier", oklch: "oklch(0.58 0.06 220)" },
  { label: "Raspberry", oklch: "oklch(0.48 0.13 0)" },
  { label: "Tarragon", oklch: "oklch(0.52 0.09 135)" },
  { label: "Cerulean", oklch: "oklch(0.50 0.11 220)" },
  { label: "Buttercup", oklch: "oklch(0.62 0.10 100)" },
  { label: "Heather", oklch: "oklch(0.50 0.06 320)" },
  { label: "Pumpkin", oklch: "oklch(0.56 0.13 50)" },
  { label: "Hunter", oklch: "oklch(0.36 0.08 160)" },
  { label: "Mauve", oklch: "oklch(0.50 0.06 350)" },
  { label: "Cornflower", oklch: "oklch(0.54 0.10 255)" },
  { label: "Caramel", oklch: "oklch(0.50 0.09 65)" },
  { label: "Thistle", oklch: "oklch(0.54 0.07 295)" },
  { label: "Carmine", oklch: "oklch(0.42 0.13 15)" },
  { label: "Algae", oklch: "oklch(0.46 0.08 170)" },
  { label: "Salmon", oklch: "oklch(0.58 0.11 30)" },
  { label: "Lagoon", oklch: "oklch(0.48 0.09 215)" },
  { label: "Plumeria", oklch: "oklch(0.56 0.10 355)" },
  { label: "Cedar", oklch: "oklch(0.44 0.08 75)" },
  { label: "Frost", oklch: "oklch(0.60 0.05 240)" },
  { label: "Garnet", oklch: "oklch(0.40 0.12 5)" },
  { label: "Verdigris", oklch: "oklch(0.50 0.07 185)" },
  { label: "Ochre", oklch: "oklch(0.52 0.10 80)" },
  { label: "Ink", oklch: "oklch(0.40 0.05 270)" },
  { label: "Flamingo", oklch: "oklch(0.58 0.12 0)" },
  { label: "Avocado", oklch: "oklch(0.50 0.08 120)" },
  { label: "Storm", oklch: "oklch(0.46 0.04 240)" },
  { label: "Papaya", oklch: "oklch(0.62 0.12 65)" },
  { label: "Currant", oklch: "oklch(0.40 0.11 340)" },
  { label: "Basil", oklch: "oklch(0.46 0.09 140)" },
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
  "tester",
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
  tester: 9, // amber
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
  /** Per-variant icon name override (lucide-react icon name). */
  variantIcons?: Partial<Record<BadgeVariantKey, string>>;
  /** Per-type icon name override (keyed by lowercased type string). */
  typeIcons?: Record<string, string>;
};

export const DEFAULT_BADGE_STYLES: BadgeStyles = {
  variants: { ...DEFAULT_VARIANT_INDEX },
  types: { ...DEFAULT_TYPE_INDEX },
  categoryDefault: DEFAULT_CATEGORY_INDEX,
  variantIcons: {},
  typeIcons: {},
};

export function mergeBadgeStyles(input: unknown): BadgeStyles {
  const v = (input ?? {}) as Partial<BadgeStyles>;
  return {
    variants: { ...DEFAULT_VARIANT_INDEX, ...(v.variants ?? {}) },
    types: { ...DEFAULT_TYPE_INDEX, ...(v.types ?? {}) },
    categoryDefault:
      typeof v.categoryDefault === "number" ? v.categoryDefault : DEFAULT_CATEGORY_INDEX,
    variantIcons: { ...(v.variantIcons ?? {}) },
    typeIcons: { ...(v.typeIcons ?? {}) },
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
