import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  BadgeCheck,
  AlertCircle,
  User,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { requireAdminBeforeLoad } from "@/lib/admin-guards";
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
  KNOWN_TYPES,
  PALETTES,
  paletteStyle,
  type BadgeStyles,
  type BadgeVariantKey,
  type KnownTypeKey,
} from "@/lib/badge-styles";
import { badgeStylesQueryKey, fetchBadgeStyles, BADGE_STYLES_KEY } from "@/hooks/use-badge-styles";

export const Route = createFileRoute("/admin/icons-badges")({
  beforeLoad: requireAdminBeforeLoad,
  head: () => ({ meta: [{ title: "Icons & Badges — Admin" }] }),
  component: AdminIconsBadgesPage,
});

const VARIANT_LABELS: Record<BadgeVariantKey, string> = {
  new: "New",
  count: "Count",
  draft: "Draft",
  custom: "Custom",
  category: "Category",
  translation: "Translation",
  admin: "Admin",
  contributor: "Contributor",
  verified: "Verified",
  unverified: "Unverified",
  user: "User",
  facility: "Facility",
};

const TYPE_LABELS: Record<KnownTypeKey, string> = {
  article: "Article",
  podcast: "Podcast",
  worksheet: "Worksheet",
  video: "Video",
  guide: "Guide",
  meeting: "Meeting",
  audio: "Audio",
  pdf: "PDF",
  link: "Link",
};

function AdminIconsBadgesPage() {
  const qc = useQueryClient();

  const { data: saved } = useQuery({
    queryKey: badgeStylesQueryKey,
    queryFn: fetchBadgeStyles,
  });

  const [draft, setDraft] = useState<BadgeStyles>(saved ?? DEFAULT_BADGE_STYLES);

  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? DEFAULT_BADGE_STYLES);

  const saveMutation = useMutation({
    mutationFn: async (next: BadgeStyles) => {
      const { error } = await supabase
        .from("site_settings")
        .upsert(
          {
            key: BADGE_STYLES_KEY,
            value: next as unknown as never,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(badgeStylesQueryKey, next);
      toast.success("Saved color combinations");
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to save"),
  });

  function nextUnusedIndex(cur: number, used: Set<number>): number {
    const n = PALETTES.length;
    // Try to find a non-used index after current
    for (let step = 1; step <= n; step++) {
      const candidate = (cur + step) % n;
      if (!used.has(candidate)) return candidate;
    }
    // All in use — fall back to plain cycle
    return (cur + 1) % n;
  }
  function cycleVariant(key: BadgeVariantKey) {
    setDraft((d) => {
      const cur = d.variants[key] ?? 0;
      const used = new Set<number>(
        BADGE_VARIANTS.filter((k) => k !== key).map((k) => d.variants[k] ?? DEFAULT_BADGE_STYLES.variants[k] ?? 0),
      );
      return { ...d, variants: { ...d.variants, [key]: nextUnusedIndex(cur, used) } };
    });
  }
  function cycleType(key: KnownTypeKey) {
    setDraft((d) => {
      const cur = d.types[key] ?? 0;
      const used = new Set<number>(
        KNOWN_TYPES.filter((k) => k !== key).map((k) => d.types[k] ?? DEFAULT_BADGE_STYLES.types[k] ?? 0),
      );
      return { ...d, types: { ...d.types, [key]: nextUnusedIndex(cur, used) } };
    });
  }
  function cycleCategoryDefault() {
    setDraft((d) => ({ ...d, categoryDefault: nextUnusedIndex(d.categoryDefault, new Set<number>()) }));
  }

  function reset() {
    setDraft(DEFAULT_BADGE_STYLES);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader
          icon={Palette}
          title="Icons & Badges"
          description="Regenerate the color combination of every badge and icon, then save to apply across the entire app."
        />
        <div className="flex w-full sm:w-auto items-center gap-2">
          <Button
            variant="outline"
            onClick={reset}
            className="px-4 py-2 text-sm w-full sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          <LoadingButton
            onClick={() => saveMutation.mutate(draft)}
            disabled={!dirty}
            pending={saveMutation.isPending}
            className="px-4 py-2 text-sm w-full sm:w-auto"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </LoadingButton>
        </div>
      </div>

      <SectionCard>
        <h2 className="font-display text-lg font-semibold">Badge Variants</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each variant uses a single curated color combination. Click Regenerate to cycle through the palette.
        </p>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BADGE_VARIANTS.map((v) => {
            const idx = draft.variants[v] ?? 0;
            const palette = PALETTES[idx];
            return (
              <li
                key={v}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BadgePreview variant={v} draft={draft} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{VARIANT_LABELS[v]}</div>
                    <div className="text-xs text-muted-foreground truncate">{palette.label}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => cycleVariant(v)}
                  className="px-4 py-2 text-sm shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard>
        <h2 className="font-display text-lg font-semibold">Content Type Badges</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Colors used by content type badges (article, video, podcast, etc.).
        </p>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {KNOWN_TYPES.map((t) => {
            const idx = draft.types[t] ?? 0;
            const palette = PALETTES[idx];
            const Icon = iconForType(t);
            const ps = paletteStyle(idx);
            return (
              <li
                key={t}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-xs font-medium"
                    style={{ color: ps.color, backgroundColor: ps.bg, borderColor: ps.border }}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2} />
                    {TYPE_LABELS[t]}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground truncate">{palette.label}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => cycleType(t)}
                  className="px-4 py-2 text-sm shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard>
        <h2 className="font-display text-lg font-semibold">Category Icon Default</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Fallback color used for any category that doesn't have its own icon color set. Per-category colors are still
          edited on each category.
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
          <div className="flex items-center gap-3 min-w-0">
            <CategoryIconPreview draft={draft} />
            <div className="min-w-0">
              <div className="text-sm font-medium">Default Category Color</div>
              <div className="text-xs text-muted-foreground truncate">
                {PALETTES[draft.categoryDefault].label}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={cycleCategoryDefault}
            className="px-4 py-2 text-sm shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate
          </Button>
        </div>
      </SectionCard>

      <SectionCard>
        <h2 className="font-display text-lg font-semibold">Palette</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The {PALETTES.length} curated color combinations. Regenerate cycles through these.
        </p>
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {PALETTES.map((p, i) => {
            const ps = paletteStyle(i);
            return (
              <li
                key={p.label}
                className="rounded-md border px-2 py-1.5 text-xs flex items-center gap-2"
                style={{ color: ps.color, backgroundColor: ps.bg, borderColor: ps.border }}
              >
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: ps.color }} />
                {p.label}
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
  category: Tag,
  translation: Languages,
  admin: Shield,
  contributor: PenLine,
  verified: BadgeCheck,
  unverified: AlertCircle,
  user: User,
  facility: Building2,
};

function BadgePreview({ variant, draft }: { variant: BadgeVariantKey; draft: BadgeStyles }) {
  const idx = draft.variants[variant] ?? 0;
  const ps = paletteStyle(idx);
  const Icon = VARIANT_ICONS[variant];
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

function CategoryIconPreview({ draft }: { draft: BadgeStyles }) {
  const palette = PALETTES[draft.categoryDefault];
  return <CategoryIcon name="default" color={palette.oklch} size="md" />;
}
