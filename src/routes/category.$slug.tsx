import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getCategory, categories } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ArrowLeft, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/category/$slug")({
  loader: ({ params }) => {
    const category = getCategory(params.slug);
    if (!category) throw notFound();
    return { category };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.category;
    const title = c ? `${c.name} — Reentry to Recovery` : "Category — Reentry to Recovery";
    const desc = c?.description ?? "Curated resources for reentry and recovery.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <div className="flex-1 mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl font-semibold">Category not found</h1>
        <p className="mt-3 text-muted-foreground">That category doesn't exist (yet).</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 text-[var(--color-accent)] font-medium">
          <ArrowLeft className="h-4 w-4" /> Back to all categories
        </Link>
      </div>
      <SiteFooter />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground text-sm">{error.message}</p>
      </div>
    </div>
  ),
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
  const { category } = Route.useLoaderData();
  const others = categories.filter((c) => c.slug !== category.slug).slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <section className="border-b border-border/60 bg-gradient-to-b from-[var(--color-secondary)] to-background">
        <div className="mx-auto max-w-5xl px-6 pt-12 pb-16">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> All categories
          </Link>
          <div className="mt-6 max-w-3xl">
            <p className="text-sm font-medium text-[var(--color-accent)]">{category.tagline}</p>
            <h1 className="mt-2 font-display text-5xl font-bold tracking-tight">{category.name}</h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{category.description}</p>
          </div>
        </div>
      </section>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="font-display text-xl font-semibold mb-6">{category.items.length} resources</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
            {category.items.map((item: typeof category.items[number]) => {
              const Wrapper: any = item.url ? "a" : "div";
              const wrapperProps = item.url
                ? { href: item.url, target: "_blank", rel: "noopener noreferrer" }
                : {};
              return (
                <li key={item.title}>
                  <Wrapper
                    {...wrapperProps}
                    className="flex flex-col sm:flex-row sm:items-start gap-4 p-6 hover:bg-[var(--color-secondary)]/60 transition-colors"
                  >
                    <div className="flex-shrink-0 flex sm:flex-col gap-2 sm:gap-1 sm:w-28">
                      <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium ${typeStyles[item.type] ?? typeStyles.Article}`}>
                        {item.type}
                      </span>
                      <span className="text-xs text-muted-foreground sm:mt-1">{item.duration}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <h3 className="font-display text-lg font-semibold text-foreground leading-snug">
                          {item.title}
                        </h3>
                        {item.url && <ExternalLink className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />}
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                      <p className="mt-2 text-xs text-muted-foreground/80">Source · {item.source}</p>
                    </div>
                  </Wrapper>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="border-t border-border/60 bg-[var(--color-secondary)]/50">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <h2 className="font-display text-xl font-semibold mb-6">Explore other categories</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {others.map((c) => (
                <Link
                  key={c.slug}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="rounded-xl border border-border bg-card p-5 hover:border-[var(--color-accent)] hover:-translate-y-0.5 transition-all"
                >
                  <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.tagline}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
