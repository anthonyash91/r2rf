import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HomePageView } from "@/components/HomePageView";
import { setActiveCustomHome } from "@/lib/custom-home-context";

export const Route = createFileRoute("/$customHome")({
  loader: async ({ params }) => {
    const { data: page, error } = await supabase
      .from("custom_home_pages")
      .select("id, slug, name")
      .eq("slug", params.customHome)
      .maybeSingle();
    if (error) throw error;
    if (!page) throw notFound();
    return { pageId: page.id, slug: page.slug };
  },
  component: CustomHomePage,
});

function CustomHomePage() {
  const { pageId, slug } = Route.useLoaderData();

  const { data: categories, isLoading } = useQuery({
    queryKey: ["custom-home-categories", pageId],
    queryFn: async () => {
      const { data: links, error: e2 } = await supabase
        .from("custom_home_page_categories")
        .select("category_id")
        .eq("custom_home_page_id", pageId);
      if (e2) throw e2;

      const selectedIds = (links ?? []).map((l) => l.category_id);
      if (selectedIds.length === 0) return [] as Category[];

      const { data: cats, error: e3 } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .in("id", selectedIds)
        .order("sort_order", { ascending: true });
      if (e3) throw e3;
      return (cats ?? []) as Category[];
    },
  });

  useEffect(() => {
    setActiveCustomHome(slug);
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <HomePageView categories={categories ?? []} isLoading={isLoading} />
      <SiteFooter />
    </div>
  );
}
