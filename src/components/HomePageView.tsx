import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { useI18n, pickLang, type Language } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Pencil } from "lucide-react";
import { resolveCategoryIcon } from "@/lib/category-icons";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/Badge";
import { BadgeGroup } from "@/components/BadgeGroup";
import { ResponsiveBadgeGroup } from "@/components/ResponsiveBadgeGroup";
import { getMyFacilityValue } from "@/lib/user-signup.functions";

type CategoryStats = { count: number; recentItemIds: Set<string> };

function useUserProgress(userId: string | null, categoryIds: string[]) {
  return useQuery({
    queryKey: ["home-user-progress", userId, [...categoryIds].sort().join(",")],
    enabled: !!userId && categoryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_content_progress")
        .select("category_id, content_item_id")
        .eq("user_id", userId!)
        .in("category_id", categoryIds);
      if (error) throw error;
      const reads: Record<string, number> = {};
      const readSet = new Set<string>();
      for (const row of data ?? []) {
        reads[row.category_id as string] = (reads[row.category_id as string] ?? 0) + 1;
        readSet.add(row.content_item_id as string);
      }
      return { reads, readSet };
    },
  });
}

// userFacility: undefined = admin (see all), null = no facility, string = specific facility
function useCategoryItemStats(categoryIds: string[], userFacility: string | null | undefined) {
  const facilityKey = userFacility === undefined ? "admin" : (userFacility ?? "anon");
  return useQuery({
    queryKey: ["category-item-stats", [...categoryIds].sort().join(","), facilityKey],
    enabled: categoryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, category_id, created_at")
        .eq("published", true)
        .in("category_id", categoryIds);
      if (error) throw error;

      // For non-admins, fetch facility restrictions so we can exclude items
      // the current user isn't allowed to see.
      const facilityMap: Record<string, string[]> = {};
      if (userFacility !== undefined) {
        const itemIds = (data ?? []).map((r: any) => r.id as string);
        if (itemIds.length > 0) {
          const { data: cifData } = await (supabase as any)
            .from("content_item_facilities")
            .select("content_item_id, facility_value")
            .in("content_item_id", itemIds);
          for (const row of (cifData ?? []) as Array<{ content_item_id: string; facility_value: string }>) {
            if (!facilityMap[row.content_item_id]) facilityMap[row.content_item_id] = [];
            facilityMap[row.content_item_id].push(row.facility_value);
          }
        }
      }

      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const stats: Record<string, CategoryStats> = {};
      for (const row of (data ?? []) as { id: string; category_id: string; created_at: string }[]) {
        const facilities = facilityMap[row.id] ?? [];
        if (facilities.length > 0) {
          if (!userFacility || !facilities.includes(userFacility)) continue;
        }
        const s = stats[row.category_id] ?? { count: 0, recentItemIds: new Set<string>() };
        s.count += 1;
        if (new Date(row.created_at).getTime() >= cutoff) s.recentItemIds.add(row.id);
        stats[row.category_id] = s;
      }
      return stats;
    },
  });
}

function useColumnCount() {
  const [cols, setCols] = useState(4);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w >= 1280) setCols(4);
      else if (w >= 1024) setCols(3);
      else if (w >= 640) setCols(2);
      else setCols(1);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return cols;
}

function MasonryCategories({ categories, lang }: { categories: Category[]; lang: Language }) {
  const cols = useColumnCount();
  const { isAdmin, user } = useAuth();
  const { t } = useI18n();
  const fetchFacilityValue = useServerFn(getMyFacilityValue);
  const { data: facilityData } = useQuery({
    queryKey: ["my-facility", user?.id],
    enabled: !!user?.id && !isAdmin,
    queryFn: () => fetchFacilityValue(),
  });
  // undefined = admin (see all), null = no facility/unauthenticated, string = facility value
  const userFacility: string | null | undefined = isAdmin
    ? undefined
    : (facilityData?.facility ?? null);
  const { data: stats = {} } = useCategoryItemStats(categories.map((c) => c.id), userFacility);
  const { data: progress } = useUserProgress(user?.id ?? null, categories.map((c) => c.id));
  const reads = progress?.reads ?? {};
  const readSet = progress?.readSet ?? new Set<string>();
  const buckets: Array<Array<{ c: Category; i: number }>> = Array.from({ length: cols }, () => []);
  categories.forEach((c, i) => buckets[i % cols].push({ c, i }));
  return (
    <div className="flex gap-9 items-start">
      {buckets.map((bucket, ci) => (
        <div key={ci} className="flex-1 flex flex-col gap-9 min-w-0">
          {bucket.map(({ c }) => {
            const s = stats[c.id] ?? { count: 0, recentItemIds: new Set<string>() };
            const count = s.count;
            const hasRecent = Array.from(s.recentItemIds).some((id) => !readSet.has(id));
            return (
            <div key={c.id} className="relative">
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-8 sm:p-10 pb-[28px] sm:pb-[36px] transition-all hover:-translate-y-1 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex">
                  {(() => {
                    const Icon = resolveCategoryIcon(c.icon_name);
                    const color = c.icon_color || "var(--color-accent)";
                    return (
                      <div
                        className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl border"
                        style={{
                          backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)`,
                          borderColor: `color-mix(in oklab, ${color} 25%, transparent)`,
                        }}
                      >
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color }} strokeWidth={1.75} />
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-5 text-left">
                  <h3 className="font-display text-base sm:text-lg font-semibold text-foreground leading-tight">
                    {pickLang(lang, c.name, c.name_es)}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{pickLang(lang, c.tagline, c.tagline_es)}</p>
                  <div className="mt-3">
                    <ResponsiveBadgeGroup>
                      <Badge variant="count">
                        {count} {t(count === 1 ? "home.item" : "home.items")}
                      </Badge>
                      {hasRecent && (
                        <Badge variant="new">{t("category.newContentAdded")}</Badge>
                      )}
                    </ResponsiveBadgeGroup>
                  </div>




                  {user && !isAdmin && count > 0 && (() => {
                    const read = Math.min(reads[c.id] ?? 0, count);
                    const pct = Math.round((read / count) * 100);
                    return (
                      <div className="mt-4 space-y-1.5">
                        <Progress value={pct} className="h-1.5" />
                        <p className="text-[11px] text-muted-foreground">
                          {t("dashboard.progressItems")
                            .replace("{done}", String(read))
                            .replace("{total}", String(count))}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/category/$id"
                  params={{ id: c.id }}
                  title="Edit category"
                  aria-label="Edit category"
                  className="absolute bottom-3 right-3 z-10 inline-flex items-center justify-center rounded-md border border-input bg-background p-2 hover:bg-muted"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              )}
            </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export type HomeHero = {
  eyebrow: string;
  heading_prefix: string;
  heading_emphasis: string;
  heading_suffix: string;
  subheading: string;
  eyebrow_es?: string;
  heading_prefix_es?: string;
  heading_emphasis_es?: string;
  heading_suffix_es?: string;
  subheading_es?: string;
};

export const DEFAULT_HERO: HomeHero = {
  eyebrow: "A library for the road back",
  heading_prefix: "Trusted resources for",
  heading_emphasis: "every step",
  heading_suffix: "of reentry and recovery.",
  subheading:
    "Pick a category to explore guides, videos, worksheets, and meetings — vetted and organized for the moments that matter.",
};

export type CertHero = {
  eyebrow: string;
  heading_prefix: string;
  heading_emphasis: string;
  heading_suffix: string;
  subheading: string;
  callout: string;
  eyebrow_es?: string;
  heading_prefix_es?: string;
  heading_emphasis_es?: string;
  heading_suffix_es?: string;
  subheading_es?: string;
  callout_es?: string;
};

export const DEFAULT_CERT: CertHero = {
  eyebrow: "New Program",
  heading_prefix: "Earn certificates that",
  heading_emphasis: "change",
  heading_suffix: "the road ahead.",
  subheading:
    "The Reentry to Recovery Certificate Program offers coursework designed for incarcerated learners — recognized credentials that may help shorten sentences, satisfy probationary requirements, and build the skills that carry forward into recovery, work, and family life.",
  callout:
    "You can find the certificate program on your tablet home screen inside the Reentry to Recovery folder",
};

export function HomePageView({
  categories,
  isLoading,
}: {
  categories: Category[];
  isLoading?: boolean;
}) {
  const { t, lang } = useI18n();

  const { data: hero = DEFAULT_HERO } = useQuery({
    queryKey: ["site_settings", "home_hero"],
    queryFn: async (): Promise<HomeHero> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "home_hero")
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_HERO, ...((data?.value as Partial<HomeHero>) ?? {}) };
    },
  });

  const { data: cert = DEFAULT_CERT } = useQuery({
    queryKey: ["site_settings", "certificate_hero"],
    queryFn: async (): Promise<CertHero> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "certificate_hero")
        .maybeSingle();
      if (error) throw error;
      return { ...DEFAULT_CERT, ...((data?.value as Partial<CertHero>) ?? {}) };
    },
  });

  const certEyebrow = pickLang(lang, cert.eyebrow, cert.eyebrow_es);
  const certPrefix = pickLang(lang, cert.heading_prefix, cert.heading_prefix_es);
  const certEmphasis = pickLang(lang, cert.heading_emphasis, cert.heading_emphasis_es);
  const certSuffix = pickLang(lang, cert.heading_suffix, cert.heading_suffix_es);
  const certSubheading = pickLang(lang, cert.subheading, cert.subheading_es);
  const certCallout = pickLang(lang, cert.callout, cert.callout_es);

  const heroEyebrow = pickLang(lang, hero.eyebrow, hero.eyebrow_es);
  const heroPrefix = pickLang(lang, hero.heading_prefix, hero.heading_prefix_es);
  const heroEmphasis = pickLang(lang, hero.heading_emphasis, hero.heading_emphasis_es);
  const heroSuffix = pickLang(lang, hero.heading_suffix, hero.heading_suffix_es);
  const heroSubheading = pickLang(lang, hero.subheading, hero.subheading_es);

  return (
    <>
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-[4px] border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]" />
              {heroEyebrow}
            </div>
            <h1 className="mt-6 font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {heroPrefix} <span className="italic text-[var(--color-accent)]">{heroEmphasis}</span> {heroSuffix}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">{heroSubheading}</p>
          </div>
        </div>
      </section>

      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-6 py-20" id="categories">
          <div className="flex items-end justify-between mb-8">
            <h2 className="font-display text-2xl font-semibold">{t("home.categories")}</h2>
            <span className="text-sm text-muted-foreground">
              {isLoading ? t("home.loading") : t(categories.length === 1 ? "home.collection" : "home.collections", { count: categories.length })}
            </span>
          </div>

          <MasonryCategories categories={categories} lang={lang} />
          {!isLoading && categories.length === 0 && (
            <p className="text-muted-foreground">{t("home.empty")}</p>
          )}
        </section>

        <section className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div>
              <div className="inline-flex items-center gap-2 rounded-[4px] border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]" />
                {certEyebrow}
              </div>
              <h2 className="mt-6 font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                {certPrefix} <span className="italic text-[var(--color-accent)]">{certEmphasis}</span> {certSuffix}
              </h2>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">{certSubheading}</p>
            </div>

            <div className="mt-10">
              <div className="rounded-2xl border border-border bg-card px-5 py-4 text-sm sm:text-base font-medium text-foreground">
                {certCallout}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
