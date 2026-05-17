import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ArrowUpRight } from "lucide-react";

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

function Index() {
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

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      <section className="border-b border-border/60">
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-gold)]" />
              A library for the road back
            </div>
            <h1 className="mt-6 font-display text-5xl sm:text-6xl font-bold tracking-tight text-foreground">
              Trusted resources for{" "}
              <span className="italic text-[var(--color-accent)]">every step</span>{" "}
              of reentry and recovery.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Pick a category to explore guides, videos, worksheets, and meetings — vetted and organized for the moments that matter.
            </p>
          </div>
        </div>
      </section>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-6" id="categories">
          <div className="flex items-end justify-between mb-8">
            <h2 className="font-display text-2xl font-semibold">Categories</h2>
            <span className="text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${categories.length} collections`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((c, i) => (
              <Link
                key={c.id}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6 transition-all hover:border-[var(--color-accent)] hover:-translate-y-1 hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between">
                  <span className="font-display text-sm font-medium text-[var(--color-gold)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
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
                  <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground leading-tight">
                    {c.name}
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{c.tagline}</p>
                </div>
              </Link>
            ))}
            {!isLoading && categories.length === 0 && (
              <p className="text-muted-foreground col-span-full">No categories yet.</p>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
