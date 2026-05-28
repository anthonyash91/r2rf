import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HomePageView } from "@/components/HomePageView";
import { SiteMessageBanner } from "@/components/SiteMessageBanner";
import { setActiveCustomHome } from "@/lib/custom-home-context";

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
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) setActiveCustomHome(null);
    });
  }, []);



  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories", "public"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const cats = (data ?? []) as Category[];
      const catIds = cats.map((c) => c.id);
      const facilityMap: Record<string, string[]> = {};
      if (catIds.length > 0) {
        const { data: links } = await (supabase as any)
          .from("category_facilities")
          .select("category_id, facility_value")
          .in("category_id", catIds);
        for (const r of (links ?? []) as { category_id: string; facility_value: string }[]) {
          if (!facilityMap[r.category_id]) facilityMap[r.category_id] = [];
          facilityMap[r.category_id].push(r.facility_value);
        }
      }
      return cats.map((c) => ({ ...c, facilities: facilityMap[c.id] ?? [] }));
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <SiteMessageBanner kind="home" />
      <HomePageView categories={categories} isLoading={isLoading} />
      <SiteFooter />
    </div>
  );
}
