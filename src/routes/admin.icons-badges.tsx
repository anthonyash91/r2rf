import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Layers,
  FileEdit,
  Star,
  Tag,
  Languages,
  Shield,
  PenLine,
  Wrench,
  BadgeCheck,
  AlertCircle,
  User,
  Building2,
  Blocks,
  HeartHandshake,
  Shuffle,
  Check,
  Info,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { requireStrictAdminBeforeLoad } from "@/lib/admin-guards";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { SectionCard } from "@/components/SectionCard";
import { iconForType } from "@/components/Badge";
import { CategoryIcon } from "@/components/CategoryIcon";
import { LoadingButton } from "@/components/LoadingButton";
import { Button } from "@/components/ui/button";
import {
  BADGE_VARIANTS,
  DEFAULT_BADGE_STYLES,
  PALETTES,
  paletteStyle,
  indexForType,
  paletteIndexOfColor,
  nextUnusedIndex,
  type BadgeStyles,
  type BadgeVariantKey,
  type KnownTypeKey,
} from "@/lib/badge-styles";
import { ICON_REGISTRY, pickRelevantIcon } from "@/lib/category-icons";
import { badgeStylesQueryKey, fetchBadgeStyles, BADGE_STYLES_KEY } from "@/hooks/use-badge-styles";

export const Route = createFileRoute("/admin/icons-badges")({
  beforeLoad: requireStrictAdminBeforeLoad,
  head: () => ({ meta: [{ title: "Icons & Badges — Admin" }] }),
  component: AdminIconsBadgesPage,
});

const VARIANT_LABELS: Record<BadgeVariantKey, string> = {
  new: "New",
  count: "Count",
  draft: "Draft",
  custom: "Custom",
  "custom-content": "Custom Item",
  category: "Category",
  translation: "Translation",
  admin: "Admin",
  contributor: "Contributor",
  tester: "Tester",
  verified: "Verified",
  unverified: "Unverified",
  user: "User",
  facility: "Facility",
  "facility-user": "Facility User",
  "exempt": "Exempt",
};

const TYPE_LABELS: Record<KnownTypeKey, string> = {
  article: "Article",
  podcast: "Podcast",
  worksheet: "Worksheet",
  video: "Video",
  guide: "Guide",
  audio: "Audio",
  pdf: "PDF",
  link: "Link",
};

const REGEN_BTN_CLASS = "px-3 py-2 text-xs shrink-0 flex-1 @[26rem]:flex-initial !shadow-none";
const REGEN_ALL_BTN_CLASS = "px-4 py-2 text-sm w-full sm:w-auto !shadow-none";


type CategoryRow = {
  id: string;
  name: string;
  icon_name: string | null;
  icon_color: string | null;
};


/** Pick `count` palette indices, preferring those not in `excluded`, starting from offset. */
function pickAvoiding(count: number, excluded: Set<number>, startOffset: number): number[] {
  const n = PALETTES.length;
  const available: number[] = [];
  for (let i = 0; i < n; i++) {
    const idx = (startOffset + i) % n;
    if (!excluded.has(idx)) available.push(idx);
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i < available.length) out.push(available[i]);
    else out.push((startOffset + i) % n);
  }
  return out;
}

/** Distribute palette indices across N items without repeats (until palette is exhausted). */
function AdminIconsBadgesPage() {
  const qc = useQueryClient();

  const { data: saved } = useQuery({
    queryKey: badgeStylesQueryKey,
    queryFn: fetchBadgeStyles,
  });

  const { data: categories } = useQuery({
    queryKey: ["admin", "icons-badges", "categories"],
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, icon_name, icon_color")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });

  const { data: dbTypes = [], error: typesError } = useQuery({
    queryKey: ["admin", "icons-badges", "content-types"],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_types")
        .select("value")
        .order("value");
      if (error) throw new Error(error.message);
      return (data ?? []).map((r: { value: string }) => r.value.toLowerCase()) as string[];
    },
  });
  const allTypes = [...dbTypes].sort((a, b) => a.localeCompare(b));

  const [draft, setDraft] = useState<BadgeStyles>(saved ?? DEFAULT_BADGE_STYLES);
  const [catDraft, setCatDraft] = useState<Record<string, string | null>>({});
  const [catIconDraft, setCatIconDraft] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  useEffect(() => {
    if (categories) {
      const colorMap: Record<string, string | null> = {};
      const iconMap: Record<string, string | null> = {};
      for (const c of categories) {
        colorMap[c.id] = c.icon_color ?? null;
        iconMap[c.id] = c.icon_name ?? null;
      }
      setCatDraft(colorMap);
      setCatIconDraft(iconMap);
    }
  }, [categories]);

  useEffect(() => {
    if (allTypes.length === 0) return;
    // Compute newTypes INSIDE the functional update so we always check against
    // the latest settled state — not a stale closure from a concurrent setDraft(saved).
    let assignedNewColors = false;
    setDraft((d) => {
      const newTypes = allTypes.filter(
        (t) => (d.types as Record<string, number>)[t] === undefined,
      );
      if (newTypes.length === 0) return d;
      const used = new Set<number>();
      for (const idx of Object.values(d.types as Record<string, number>)) {
        if (idx !== undefined) used.add(idx);
      }
      for (const k of BADGE_VARIANTS) {
        const idx = d.variants[k];
        if (idx !== undefined) used.add(idx);
      }
      const types = { ...(d.types as Record<string, number>) };
      for (const t of newTypes) {
        if (types[t] === undefined) {
          const idx = nextUnusedIndex(0, used);
          types[t] = idx;
          used.add(idx);
          assignedNewColors = true;
        }
      }
      if (!assignedNewColors) return d;
      const next = { ...d, types: types as any };
      // Persist immediately so the assigned colors survive page reloads
      // without the user having to manually click Save Changes.
      Promise.resolve(
        supabase.from("site_settings").upsert(
          { key: BADGE_STYLES_KEY, value: next as unknown as never, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        )
      ).then(() => qc.invalidateQueries({ queryKey: [...badgeStylesQueryKey] })).catch(() => {});
      return next;
    });
  }, [allTypes.join(",")]);

  const originalCatMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const c of categories ?? []) m[c.id] = c.icon_color ?? null;
    return m;
  }, [categories]);
  const originalCatIconMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const c of categories ?? []) m[c.id] = c.icon_name ?? null;
    return m;
  }, [categories]);

  const dirtyStyles = JSON.stringify(draft) !== JSON.stringify(saved ?? DEFAULT_BADGE_STYLES);
  const dirtyCats = useMemo(() => {
    const ids = Object.keys(catDraft);
    return ids.some((id) => (catDraft[id] ?? null) !== (originalCatMap[id] ?? null));
  }, [catDraft, originalCatMap]);
  const dirtyCatIcons = useMemo(() => {
    const ids = Object.keys(catIconDraft);
    return ids.some((id) => (catIconDraft[id] ?? null) !== (originalCatIconMap[id] ?? null));
  }, [catIconDraft, originalCatIconMap]);
  const dirty = dirtyStyles || dirtyCats || dirtyCatIcons;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dirtyStyles) {
        const { error } = await supabase
          .from("site_settings")
          .upsert(
            {
              key: BADGE_STYLES_KEY,
              value: draft as unknown as never,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" },
          );
        if (error) throw error;
      }
      // Build per-category updates (color and/or icon_name) and apply with one update per row.
      const catIds = new Set<string>([
        ...Object.keys(catDraft),
        ...Object.keys(catIconDraft),
      ]);
      for (const id of catIds) {
        const colorChanged = (catDraft[id] ?? null) !== (originalCatMap[id] ?? null);
        const iconChanged = (catIconDraft[id] ?? null) !== (originalCatIconMap[id] ?? null);
        if (!colorChanged && !iconChanged) continue;
        const patch: { icon_color?: string | null; icon_name?: string | null } = {};
        if (colorChanged) patch.icon_color = catDraft[id] ?? null;
        if (iconChanged) patch.icon_name = catIconDraft[id] ?? null;
        const { error } = await supabase.from("categories").update(patch).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.setQueryData(badgeStylesQueryKey, draft);
      qc.invalidateQueries({ queryKey: ["admin", "icons-badges", "categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Saved icons & colors");
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to save"),
  });

  // -------- Global usage tracking --------
  /** All palette indices currently in use across variants, types, default, and categories. */
  function collectGlobalIndices(
    d: BadgeStyles,
    cd: Record<string, string | null>,
    skip?: { kind: "variant" | "type" | "default" | "category"; key?: string },
  ): number[] {
    const out: number[] = [];
    for (const k of BADGE_VARIANTS) {
      if (skip?.kind === "variant" && skip.key === k) continue;
      out.push(d.variants[k] ?? DEFAULT_BADGE_STYLES.variants[k] ?? 0);
    }
    for (const k of allTypes) {
      if (skip?.kind === "type" && skip.key === k) continue;
      out.push((d.types as Record<string, number>)[k] ?? (DEFAULT_BADGE_STYLES.types as Record<string, number>)[k] ?? indexForType(k, d));
    }
    for (const [id, v] of Object.entries(cd)) {
      if (skip?.kind === "category" && skip.key === id) continue;
      const idx = paletteIndexOfColor(v);
      if (idx >= 0) out.push(idx);
    }
    return out;
  }

  const usageCount = useMemo(() => {
    const m = new Map<number, number>();
    for (const idx of collectGlobalIndices(draft, catDraft)) {
      m.set(idx, (m.get(idx) ?? 0) + 1);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, catDraft]);

  const isDup = (idx: number) => (usageCount.get(idx) ?? 0) > 1;

  // -------- Variant cycling --------
  function cycleVariant(key: BadgeVariantKey) {
    setDraft((d) => {
      const cur = d.variants[key] ?? 0;
      const used = new Set<number>(collectGlobalIndices(d, catDraft, { kind: "variant", key }));
      return { ...d, variants: { ...d.variants, [key]: nextUnusedIndex(cur, used) } };
    });
  }
  function regenerateAllVariants() {
    setDraft((d) => {
      const excluded = new Set<number>(collectGlobalIndices(d, catDraft));
      // remove this section's own indices from excluded (we're replacing them)
      for (const k of BADGE_VARIANTS) excluded.delete(d.variants[k] ?? 0);
      const indices = pickAvoiding(
        BADGE_VARIANTS.length,
        excluded,
        Math.floor(Math.random() * PALETTES.length),
      );
      const variants: Partial<Record<BadgeVariantKey, number>> = {};
      BADGE_VARIANTS.forEach((k, i) => (variants[k] = indices[i]));
      return { ...d, variants };
    });
  }

  // -------- Type cycling --------
  function cycleType(key: string) {
    setDraft((d) => {
      const cur = (d.types as any)[key] ?? 0;
      const used = new Set<number>(collectGlobalIndices(d, catDraft, { kind: "type", key }));
      return { ...d, types: { ...d.types, [key]: nextUnusedIndex(cur, used) } };
    });
  }
  function regenerateAllTypes() {
    setDraft((d) => {
      const excluded = new Set<number>(collectGlobalIndices(d, catDraft));
      for (const k of allTypes) excluded.delete((d.types as any)[k] ?? 0);
      const indices = pickAvoiding(
        allTypes.length,
        excluded,
        Math.floor(Math.random() * PALETTES.length),
      );
      const types: Record<string, number> = {};
      allTypes.forEach((k, i) => (types[k] = indices[i]));
      return { ...d, types: { ...d.types, ...types } };
    });
  }

  // -------- Icon cycling (per-row) --------
  function cycleVariantIcon(key: BadgeVariantKey) {
    setDraft((d) => {
      const cur = d.variantIcons?.[key] ?? null;
      const next = pickRelevantIcon({ title: VARIANT_LABELS[key], exclude: cur });
      return { ...d, variantIcons: { ...(d.variantIcons ?? {}), [key]: next } };
    });
  }
  function cycleTypeIcon(key: string) {
    setDraft((d) => {
      const cur = d.typeIcons?.[key] ?? null;
      const next = pickRelevantIcon({ title: (TYPE_LABELS as Record<string, string>)[key] ?? key, exclude: cur });
      return { ...d, typeIcons: { ...(d.typeIcons ?? {}), [key]: next } };
    });
  }
  function cycleCategoryIconFor(id: string, name: string) {
    setCatIconDraft((d) => {
      const cur = d[id] ?? null;
      const next = pickRelevantIcon({ title: name, exclude: cur });
      return { ...d, [id]: next };
    });
  }

  // -------- Per-category color --------


  function cycleCategory(id: string) {
    setCatDraft((d) => {
      const cur = paletteIndexOfColor(d[id]);
      const used = new Set<number>(collectGlobalIndices(draft, d, { kind: "category", key: id }));
      const next = nextUnusedIndex(cur >= 0 ? cur : 0, used);
      return { ...d, [id]: PALETTES[next].oklch };
    });
  }
  function regenerateAllCategories() {
    setCatDraft((d) => {
      const ids = Object.keys(d);
      const excluded = new Set<number>(collectGlobalIndices(draft, d));
      for (const id of ids) {
        const idx = paletteIndexOfColor(d[id]);
        if (idx >= 0) excluded.delete(idx);
      }
      const indices = pickAvoiding(
        ids.length,
        excluded,
        Math.floor(Math.random() * PALETTES.length),
      );
      const next: Record<string, string | null> = {};
      ids.forEach((id, i) => (next[id] = PALETTES[indices[i]].oklch));
      return next;
    });
  }

  function reset() {
    setDraft(DEFAULT_BADGE_STYLES);
    setCatDraft({ ...originalCatMap });
    setCatIconDraft({ ...originalCatIconMap });
  }


  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          icon={Palette}
          title="Icons & Badges"
          description="Regenerate the color combination of every badge and icon, then save to apply across the entire app."
        />
        <div className="flex w-full lg:w-auto items-center gap-2">
          <Button
            variant="outline"
            onClick={reset}
            className="px-4 py-2 text-sm w-full lg:w-auto whitespace-nowrap !shadow-none"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <LoadingButton
            onClick={() => saveMutation.mutate()}
            disabled={!dirty}
            pending={saveMutation.isPending}
            className="px-4 py-2 text-sm w-full lg:w-auto whitespace-nowrap"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </LoadingButton>
        </div>
      </div>

      <SectionCard className="mt-8 pt-[18px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Badge Variants</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each variant uses a single curated color combination. Click Regenerate to cycle through the palette.
            </p>
          </div>
          <Button variant="outline" onClick={regenerateAllVariants} className={REGEN_ALL_BTN_CLASS}>
            <Shuffle className="h-4 w-4" />
            Regenerate All
          </Button>
        </div>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...BADGE_VARIANTS].sort((a, b) => a.localeCompare(b)).map((v) => {
            const idx = draft.variants[v] ?? 0;
            const palette = PALETTES[idx];
            const dup = isDup(idx);
            return (
              <li
                key={v}
                className={`@container flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/40 p-3 ${dup ? "border-amber-500/60 ring-1 ring-amber-500/40" : "border-border"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BadgePreview variant={v} draft={draft} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{VARIANT_LABELS[v]}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {palette.label}
                      {dup && <span className="ml-1 text-amber-500">• duplicate</span>}
                    </div>
                  </div>
                </div>
                <div className="flex w-full @[26rem]:w-auto items-center gap-2">
                  <Button variant="outline" onClick={() => cycleVariant(v)} className={REGEN_BTN_CLASS}>
                    <RefreshCw className="h-4 w-4" />
                    Color
                  </Button>
                  <Button variant="outline" onClick={() => cycleVariantIcon(v)} className={REGEN_BTN_CLASS}>
                    <RefreshCw className="h-4 w-4" />
                    Icon
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

      </SectionCard>

      <SectionCard className="mt-8 pt-[18px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Content Type Badges</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Colors used by content type badges (article, video, podcast, etc.).
            </p>
          </div>
          <Button variant="outline" onClick={regenerateAllTypes} className={REGEN_ALL_BTN_CLASS}>
            <Shuffle className="h-4 w-4" />
            Regenerate All
          </Button>
        </div>
        {typesError && (
          <p className="mt-4 text-sm text-destructive">{(typesError as Error).message}</p>
        )}
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {allTypes.map((t) => {
            const idx = (draft.types as Record<string, number>)[t] ?? indexForType(t, draft);
            const palette = PALETTES[idx];
            const overrideIconName = draft.typeIcons?.[t];
            const Icon =
              (overrideIconName && ICON_REGISTRY[overrideIconName]) || iconForType(t);
            const ps = paletteStyle(idx);
            const dup = isDup(idx);
            return (
              <li
                key={t}
                className={`@container flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/40 p-3 ${dup ? "border-amber-500/60 ring-1 ring-amber-500/40" : "border-border"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-xs font-medium"
                    style={{ color: ps.color, backgroundColor: ps.bg, borderColor: ps.border }}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2} />
                    <span className="capitalize">{(TYPE_LABELS as Record<string, string>)[t] ?? t}</span>
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground truncate">
                      {palette.label}
                      {dup && <span className="ml-1 text-amber-500">• duplicate</span>}
                    </div>
                  </div>
                </div>
                <div className="flex w-full @[26rem]:w-auto items-center gap-2">
                  <input
                    type="text"
                    value={(draft.typeNamesEs as Record<string, string> | undefined)?.[t] ?? ""}
                    onChange={(e) => setDraft((prev) => ({
                      ...prev,
                      typeNamesEs: { ...(prev.typeNamesEs ?? {}), [t]: e.target.value },
                    }))}
                    placeholder="Spanish name…"
                    className="w-28 rounded-md border border-input bg-background px-3 py-2 text-xs"
                  />
                  <Button variant="outline" onClick={() => cycleType(t)} className={REGEN_BTN_CLASS}>
                    <RefreshCw className="h-4 w-4" />
                    Color
                  </Button>
                  <Button variant="outline" onClick={() => cycleTypeIcon(t)} className={REGEN_BTN_CLASS}>
                    <RefreshCw className="h-4 w-4" />
                    Icon
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

      </SectionCard>

      <SectionCard className="mt-8 pt-[18px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Category Icons</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Per-category icon colors. Regenerate cycles each through the palette without repeating.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={regenerateAllCategories}
            disabled={!categories || categories.length === 0}
            className={REGEN_ALL_BTN_CLASS}
          >
            <Shuffle className="h-4 w-4" />
            Regenerate All
          </Button>
        </div>

        {categories && categories.length > 0 && (
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.map((c) => {
              const color = catDraft[c.id] ?? c.icon_color ?? null;
              const iconName = catIconDraft[c.id] ?? c.icon_name ?? null;
              const idx = paletteIndexOfColor(color);
              const label = idx >= 0 ? PALETTES[idx].label : "Custom";
              const dup = idx >= 0 && isDup(idx);
              return (
                <li
                  key={c.id}
                  className={`@container flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/40 p-3 ${dup ? "border-amber-500/60 ring-1 ring-amber-500/40" : "border-border"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon name={iconName} color={color} size="sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {label}
                        {dup && <span className="ml-1 text-amber-500">• duplicate</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full @[26rem]:w-auto items-center gap-2">
                    <Button variant="outline" onClick={() => cycleCategory(c.id)} className={REGEN_BTN_CLASS}>
                      <RefreshCw className="h-4 w-4" />
                      Color
                    </Button>
                    <Button variant="outline" onClick={() => cycleCategoryIconFor(c.id, c.name)} className={REGEN_BTN_CLASS}>
                      <RefreshCw className="h-4 w-4" />
                      Icon
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      </SectionCard>

      <SectionCard className="mt-8 pt-[18px]">
        <h2 className="font-display text-lg font-semibold">Palette</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The {PALETTES.length} curated color combinations. Regenerate cycles through these.
        </p>
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {[...PALETTES.map((p, i) => ({ ...p, i }))]
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(({ label, i }) => {
              const ps = paletteStyle(i);
              const count = usageCount.get(i) ?? 0;
              const used = count > 0;
              return (
                <li
                  key={label}
                  className={`rounded-md border px-2 py-1.5 text-xs flex items-center gap-2 ${used ? "" : "opacity-70"}`}
                  style={{ color: ps.color, backgroundColor: ps.bg, borderColor: ps.border }}
                  title={used ? `Used ${count}×` : "Unused"}
                >
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: ps.color }} />
                  <span className="flex-1 truncate">{label}</span>
                  {used && (
                    <span className="inline-flex items-center gap-0.5 shrink-0">
                      <Check className="h-3.5 w-3.5" aria-label="Used" />
                      {count > 1 && <span className="text-[10px] font-medium">×{count}</span>}
                    </span>
                  )}
                </li>
              );
            })}
        </ul>
      </SectionCard>
    </div>
  );
}

const VARIANT_ICONS: Record<BadgeVariantKey, LucideIcon> = {
  new: Sparkles,
  count: Layers,
  draft: FileEdit,
  custom: Star,
  "custom-content": Blocks,
  category: Tag,
  translation: Languages,
  admin: Shield,
  contributor: PenLine,
  tester: Wrench,
  verified: BadgeCheck,
  unverified: AlertCircle,
  user: User,
  facility: Building2,
  "facility-user": HeartHandshake,
  "exempt": Info,
};

function BadgePreview({ variant, draft }: { variant: BadgeVariantKey; draft: BadgeStyles }) {
  const idx = draft.variants[variant] ?? 0;
  const ps = paletteStyle(idx);
  const overrideName = draft.variantIcons?.[variant];
  const Icon = (overrideName && ICON_REGISTRY[overrideName]) || VARIANT_ICONS[variant];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-xs font-medium"
      style={{ color: ps.color, backgroundColor: ps.bg, borderColor: ps.border }}
    >
      <Icon className="h-3 w-3" strokeWidth={2} />
      {VARIANT_LABELS[variant]}
    </span>
  );
}
