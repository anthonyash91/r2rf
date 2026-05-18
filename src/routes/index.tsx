import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useI18n, pickLang, type Language } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { ArrowUpRight, Pencil } from "lucide-react";

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
  const { isAdmin } = useAuth();
  const buckets: Array<Array<{ c: Category; i: number }>> = Array.from({ length: cols }, () => []);
  categories.forEach((c, i) => buckets[i % cols].push({ c, i }));
  return (
    <div className="flex gap-9 items-start">
      {buckets.map((bucket, ci) => (
        <div key={ci} className="flex-1 flex flex-col gap-9 min-w-0">
          {bucket.map(({ c, i }) => (
            <div key={c.id} className="relative">
              <Link
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-7 sm:p-8 transition-all hover:border-[var(--color-accent)] hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-end">
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--color-accent)]" />
                </div>
                <div className="mt-4 flex justify-start">
                  {c.icon_url ? (
                    <img
                      src={c.icon_url}
                      alt=""
                      className="h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32 rounded-xl object-cover border border-border bg-muted"
                    />
                  ) : (
                    <div className="h-24 w-24 sm:h-28 sm:w-28 lg:h-32 lg:w-32 rounded-xl border border-dashed border-border bg-muted/40" />
                  )}
                </div>
                <div className="mt-3">
                  <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground leading-tight flex items-baseline gap-2">
                    <span className="text-[var(--color-gold)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{pickLang(lang, c.name, c.name_es)}</span>
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{pickLang(lang, c.tagline, c.tagline_es)}</p>
                </div>
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/category/$id"
                  params={{ id: c.id }}
                  title="Edit category"
                  aria-label="Edit category"
                  className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1 rounded-md border border-border bg-background/90 backdrop-blur px-2 py-1 text-xs font-medium text-foreground hover:bg-muted hover:border-[var(--color-accent)] shadow-sm"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reentry to Recovery — Content Library" },
      { name: "description", content: "A curated library of resources for health, parenting, employment, and recovery after reentry." },
      { property: "og:title", content: "Reentry to Recovery — Content Library" },
      { property: "og:description", content: "Resources for the road back — wellness, family, work, and recovery." },
    ],
  }),
  component: Index,
});

type HomeHero = {
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

const DEFAULT_HERO: HomeHero = {
  eyebrow: "A library for the road back",
  heading_prefix: "Trusted resources for",
  heading_emphasis: "every step",
  heading_suffix: "of reentry and recovery.",
  subheading: "Pick a category to explore guides, videos, worksheets, and meetings — vetted and organized for the moments that matter.",
};

type CertHero = {
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

const DEFAULT_CERT: CertHero = {
  eyebrow: "New Program",
  heading_prefix: "Earn certificates that",
  heading_emphasis: "change",
  heading_suffix: "the road ahead.",
  subheading: "The Reentry to Recovery Certificate Program offers coursework designed for incarcerated learners — recognized credentials that may help shorten sentences, satisfy probationary requirements, and build the skills that carry forward into recovery, work, and family life.",
  callout: "You can find the certificate program on your tablet home screen inside the Reentry to Recovery folder",
};

function Index() {
  const { t, lang } = useI18n();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories", "public"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
  });

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
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]" />
              {heroEyebrow}
            </div>
            <h1 className="mt-6 font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              {heroPrefix}{" "}
              <span className="italic text-[var(--color-accent)]">{heroEmphasis}</span>{" "}
              {heroSuffix}
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              {heroSubheading}
            </p>
          </div>
        </div>
      </section>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-20" id="categories">
          <div className="flex items-end justify-between mb-8">
            <h2 className="font-display text-2xl font-semibold">{t("home.categories")}</h2>
            <span className="text-sm text-muted-foreground">
              {isLoading ? t("home.loading") : t("home.collections", { count: categories.length })}
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
                {certPrefix}{" "}
                <span className="italic text-[var(--color-accent)]">{certEmphasis}</span>{" "}
                {certSuffix}
              </h2>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                {certSubheading}
              </p>
            </div>

            <div className="mt-10">
              <div className="rounded-2xl border border-border bg-card px-5 py-4 text-sm sm:text-base font-medium text-foreground">
                {certCallout}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
