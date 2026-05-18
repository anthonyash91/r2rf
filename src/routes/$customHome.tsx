import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HomePageView } from "@/components/HomePageView";

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

      const ids = (links ?? []).map((l) => l.category_id);
      if (ids.length === 0) return { page, categories: [] as Category[] };

      const { data: cats, error: e3 } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .in("id", ids);
      if (e3) throw e3;

      const orderMap = new Map(
        (links ?? []).map((l, idx) => [l.category_id, l.sort_order ?? idx]),
      );
      const sorted = ((cats ?? []) as Category[]).slice().sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      );
      return { page, categories: sorted };
    },
  });

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
