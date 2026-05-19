import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HomePageView } from "@/components/HomePageView";
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
    setActiveCustomHome(null);
  }, []);


  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories", "public"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .eq("home_page_mode", "default")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Category[];
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <HomePageView categories={categories} isLoading={isLoading} />
      <SiteFooter />
    </div>
  );
}
