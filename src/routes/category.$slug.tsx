import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Category, ContentItem } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, ExternalLink, Download, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/category/$slug")({
  component: CategoryPage,
});

const typeStyles: Record<string, string> = {
  Article: "bg-[var(--color-secondary)] text-[var(--color-primary)]",
  Video: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  Podcast: "bg-[var(--color-gold)]/20 text-[var(--color-foreground)]",
  Worksheet: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  Meeting: "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
  Guide: "bg-[var(--color-gold)]/15 text-[var(--color-foreground)]",
};

function CategoryPage() {
  const { slug } = Route.useParams();
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      const { data: cat, error: e1 } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (e1) throw e1;
      if (!cat) throw notFound();
      const { data: items, error: e2 } = await supabase
        .from("content_items")
        .select("*")
        .eq("category_id", cat.id)
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (e2) throw e2;
      const { data: others, error: e3 } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .neq("id", cat.id)
        .order("sort_order", { ascending: true });
      if (e3) throw e3;
      return {
        category: cat as Category,
        items: (items ?? []) as ContentItem[],
        others: (others ?? []) as Category[],
      };
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {isLoading && (
        <div className="flex-1 mx-auto max-w-5xl px-6 py-24 text-muted-foreground">{t("home.loading")}</div>
      )}

      {error && !isLoading && (
        <div className="flex-1 mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-display text-4xl font-semibold">{t("category.notFound")}</h1>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-[var(--color-accent)] font-medium">
            <ArrowLeft className="h-4 w-4" /> {t("category.backToAll")}
          </Link>
        </div>
      )}

      {data && (
        <>
          <section className="border-b border-border/60 bg-gradient-to-b from-[var(--color-secondary)] to-background">
            <div className="mx-auto max-w-5xl px-6 pt-12 pb-16">
              <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-4 w-4" /> {t("category.allCategories")}
              </Link>
              <div className="mt-6 flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                {data.category.icon_url && (
                  <img
                    src={data.category.icon_url}
                    alt=""
                    className="h-24 w-24 sm:h-32 sm:w-32 lg:h-40 lg:w-40 rounded-2xl object-cover border border-border bg-muted flex-shrink-0"
                  />
                )}
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-[var(--color-accent)]">{data.category.tagline}</p>
                  <h1 className="mt-2 font-display text-5xl font-bold tracking-tight">{data.category.name}</h1>
                  <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{data.category.description}</p>
                </div>
              </div>
            </div>
          </section>

          <main className="flex-1">
            <section className="mx-auto max-w-5xl px-6 py-12">
              <h2 className="font-display text-xl font-semibold mb-6">{data.items.length} {data.items.length === 1 ? t("category.resource") : t("category.resources")}</h2>
              {data.items.length === 0 ? (
                <p className="text-muted-foreground">{t("category.noContent")}</p>
              ) : (
                <ul className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
                  {data.items.map((item) => {
                    const Wrapper: any = item.url ? "a" : "div";
                    const wrapperProps = item.url
                      ? { href: item.url, target: "_blank", rel: "noopener noreferrer" }
                      : {};
                    return (
                      <li key={item.id}>
                        <Wrapper
                          {...wrapperProps}
                          className="flex flex-col sm:flex-row sm:items-start gap-4 p-6 hover:bg-[var(--color-secondary)]/60 transition-colors"
                        >
                          <div className="flex-shrink-0 flex sm:flex-col gap-2 sm:gap-1 sm:w-28">
                            <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium ${typeStyles[item.type] ?? typeStyles.Article}`}>
                              {item.type}
                            </span>
                            {item.duration && <span className="text-xs text-muted-foreground sm:mt-1">{item.duration}</span>}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start gap-2">
                              <h3 className="font-display text-lg font-semibold text-foreground leading-snug">
                                {item.title}
                              </h3>
                              {item.url && <ExternalLink className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />}
                            </div>
                            {item.description && <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{item.description}</p>}
                            {item.file_url && (
                              <a
                                href={item.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
                              >
                                <Download className="h-3.5 w-3.5" />
                                {item.file_name || "Download file"}
                              </a>
                            )}
                            {item.source && <p className="mt-2 text-xs text-muted-foreground/80">Source · {item.source}</p>}
                          </div>
                        </Wrapper>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {data.others.length > 0 && (
              <section className="mx-auto max-w-5xl px-6 pb-16">
                <div className="border-t border-border/60 pt-12">
                  <h2 className="font-display text-xl font-semibold mb-6">Explore other categories</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.others.map((other) => (
                      <Link
                        key={other.id}
                        to="/category/$slug"
                        params={{ slug: other.slug }}
                        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-[var(--color-accent)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
                      >
                        {other.icon_url ? (
                          <img
                            src={other.icon_url}
                            alt=""
                            className="h-14 w-14 rounded-xl object-cover border border-border bg-muted flex-shrink-0"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-xl border border-dashed border-border bg-muted/40 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-base font-semibold text-foreground leading-tight truncate">
                            {other.name}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">{other.tagline}</p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--color-accent)] flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </main>
        </>
      )}

      <SiteFooter />
    </div>
  );
}
