import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HomePageView } from "@/components/HomePageView";
import { setActiveCustomHome } from "@/lib/custom-home-context";

export const Route = createFileRoute("/$customHome")({
  component: CustomHomePage,
});

function CustomHomePage() {
  const { customHome } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["custom-home", customHome],
    queryFn: async () => {
      const { data: page, error: e1 } = await supabase
        .from("custom_home_pages")
        .select("id, slug, name")
        .eq("slug", customHome)
        .maybeSingle();
      if (e1) throw e1;
      if (!page) return null;

      const { data: links, error: e2 } = await supabase
        .from("custom_home_page_categories")
        .select("category_id, sort_order")
        .eq("custom_home_page_id", page.id)
        .order("sort_order", { ascending: true });
      if (e2) throw e2;

      // Default-mode categories always appear; explicitly-selected custom ones also appear.
      const { data: defaults, error: e3 } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .eq("home_page_mode", "default")
        .order("sort_order", { ascending: true });
      if (e3) throw e3;

      const selectedIds = (links ?? []).map((l) => l.category_id);
      let selected: Category[] = [];
      if (selectedIds.length > 0) {
        const { data: cats, error: e4 } = await supabase
          .from("categories")
          .select("*")
          .eq("published", true)
          .in("id", selectedIds);
        if (e4) throw e4;
        selected = (cats ?? []) as Category[];
      }

      const linkOrder = new Map(
        (links ?? []).map((l, idx) => [l.category_id, l.sort_order ?? idx]),
      );
      const selectedSorted = selected
        .slice()
        .sort((a, b) => (linkOrder.get(a.id) ?? 0) - (linkOrder.get(b.id) ?? 0));

      // De-dupe in case a category is both "default" and explicitly selected.
      const seen = new Set<string>();
      const categories = [...(defaults as Category[]), ...selectedSorted].filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      return { page, categories };
    },
  });

  useEffect(() => {
    if (data?.page?.slug) {
      setActiveCustomHome(data.page.slug);
    }
  }, [data?.page?.slug]);

  if (!isLoading && !error && data === null) {
    throw notFound();
  }


  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <HomePageView categories={data?.categories ?? []} isLoading={isLoading} />
      <SiteFooter />
    </div>
  );
}
