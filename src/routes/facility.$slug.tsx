import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HomePageView } from "@/components/HomePageView";
import { SiteMessageBanner } from "@/components/SiteMessageBanner";
import { setActiveCustomHome } from "@/lib/custom-home-context";
import { setActiveFacilitySlug } from "@/lib/facility-context";

export const Route = createFileRoute("/facility/$slug")({
  loader: async ({ params }) => {
    const { data: facility, error } = await supabase
      .from("facilities")
      .select("id, value, label")
      .eq("value", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!facility) throw notFound();
    return { facilityValue: facility.value as string, facilityLabel: facility.label as string };
  },
  component: FacilityPage,
});

function FacilityPage() {
  const { facilityValue } = Route.useLoaderData();

  useEffect(() => {
    setActiveCustomHome(null);
    setActiveFacilitySlug(facilityValue);
  }, [facilityValue]);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["facility-categories", facilityValue],
    queryFn: async (): Promise<Category[]> => {
      // Fetch all published categories
      const { data: cats, error } = await supabase
        .from("categories")
        .select("*")
        .eq("published", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;

      const allCats = (cats ?? []) as Category[];
      const catIds = allCats.map((c) => c.id);
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

      // Show: categories with no facility restrictions + categories assigned to this facility
      return allCats
        .filter((c) => {
          const f = facilityMap[c.id] ?? [];
          if (f.length === 0) return true;
          return f.includes(facilityValue);
        })
        .map((c) => ({ ...c, facilities: facilityMap[c.id] ?? [] }));
    },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <SiteMessageBanner kind="home" />
      <HomePageView categories={categories} isLoading={isLoading} facilityContext={facilityValue} />
      <SiteFooter />
    </div>
  );
}
