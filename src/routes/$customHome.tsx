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
        .select("category_id")
        .eq("custom_home_page_id", page.id);
      if (e2) throw e2;

      const selectedIds = (links ?? []).map((l) => l.category_id);
      let selected: Category[] = [];
      if (selectedIds.length > 0) {
        const { data: cats, error: e3 } = await supabase
          .from("categories")
          .select("*")
          .eq("published", true)
          .in("id", selectedIds)
          .order("sort_order", { ascending: true });
        if (e3) throw e3;
        selected = (cats ?? []) as Category[];
      }

      return { page, categories: selected };
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
