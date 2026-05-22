import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { useI18n, pickLang, type Language } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { Pencil } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/Badge";

type CategoryStats = { count: number; hasRecent: boolean };

function useUserProgress(userId: string | null, categoryIds: string[]) {
  return useQuery({
    queryKey: ["home-user-progress", userId, [...categoryIds].sort().join(",")],
    enabled: !!userId && categoryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_content_progress")
        .select("category_id")
        .eq("user_id", userId!)
        .in("category_id", categoryIds);
      if (error) throw error;
      const reads: Record<string, number> = {};
      for (const row of data ?? []) {
        reads[row.category_id as string] = (reads[row.category_id as string] ?? 0) + 1;
      }
      return reads;
    },
  });
}

function useCategoryItemStats(categoryIds: string[]) {
  return useQuery({
    queryKey: ["category-item-stats", [...categoryIds].sort().join(",")],
    enabled: categoryIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("category_id, created_at")
        .eq("published", true)
        .in("category_id", categoryIds);
      if (error) throw error;
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const stats: Record<string, CategoryStats> = {};
      (data ?? []).forEach((row: { category_id: string; created_at: string }) => {
        const s = stats[row.category_id] ?? { count: 0, hasRecent: false };
        s.count += 1;
        if (new Date(row.created_at).getTime() >= cutoff) s.hasRecent = true;
        stats[row.category_id] = s;
      });
      return stats;
    },
  });
}

function useColumnCount() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w >= 1024) setCols(3);
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
  const { data: stats = {} } = useCategoryItemStats(categories.map((c) => c.id));
  const { data: reads = {} } = useUserProgress(user?.id ?? null, categories.map((c) => c.id));
  const buckets: Array<Array<{ c: Category; i: number }>> = Array.from({ length: cols }, () => []);
  categories.forEach((c, i) => buckets[i % cols].push({ c, i }));
  return (
    <div className="flex gap-9 items-start">
      {buckets.map((bucket, ci) => (
        <div key={ci} className="flex-1 flex flex-col gap-9 min-w-0">
          {bucket.map(({ c }) => {
            const s = stats[c.id] ?? { count: 0, hasRecent: false };
            const count = s.count;
            return (
            <div key={c.id} className="relative">
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-8 sm:p-10 pb-6 sm:pb-8 transition-all hover:-translate-y-1 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex justify-center">
                  {c.icon_url ? (
                    <img
                      src={c.icon_url}
                      alt=""
                      className="h-48 w-48 sm:h-56 sm:w-56 lg:h-64 lg:w-64 rounded-xl object-cover border border-border bg-muted"
                    />
                  ) : (
                    <div className="h-48 w-48 sm:h-56 sm:w-56 lg:h-64 lg:w-64 rounded-xl border border-dashed border-border bg-muted/40" />
                  )}
                </div>
                <div className="mt-5 text-center">
                  <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground leading-tight">
                    {pickLang(lang, c.name, c.name_es)}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{pickLang(lang, c.tagline, c.tagline_es)}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <Badge variant="count">
                      {count} {t(count === 1 ? "home.item" : "home.items")}
                    </Badge>
                    {s.hasRecent && (
                      <Badge variant="new">{t("category.newContentAdded")}</Badge>
                    )}
                  </div>



                  {user && !isAdmin && count > 0 && (() => {
                    const read = reads[c.id] ?? 0;
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
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
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
        <section className="mx-auto max-w-6xl px-6 py-20" id="categories">
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
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
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
