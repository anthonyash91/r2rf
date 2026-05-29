import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HomePageView } from "@/components/HomePageView";
import { SiteMessageBanner } from "@/components/SiteMessageBanner";
import { setActiveFacilitySlug } from "@/lib/facility-context";

export const Route = createFileRoute("/facility/$slug")({
  loader: async ({ params }) => {
    const { data: facility, error } = await supabase
      .from("facilities")
      .select("id, value, label, custom_slug")
      .or(`value.eq.${params.slug},custom_slug.eq.${params.slug}`)
      .maybeSingle();
    if (error) throw error;
    if (!facility) throw notFound();
    const activeSlug = (facility.custom_slug ?? facility.value) as string;
    // When a custom slug exists and the visitor used the value slug, redirect to the canonical URL
    if (facility.custom_slug && params.slug !== facility.custom_slug) {
      throw redirect({ to: "/facility/$slug", params: { slug: activeSlug } });
    }
    return {
      facilityValue: facility.value as string,
      facilityLabel: facility.label as string,
      facilitySlug: activeSlug,
    };
  },
  component: FacilityPage,
});

function FacilityPage() {
  const { facilityValue, facilitySlug } = Route.useLoaderData();

  useEffect(() => {
    setActiveFacilitySlug(facilitySlug);
  }, [facilitySlug]);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["facility-categories", facilityValue],
    staleTime: 10 * 60 * 1000,
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
      <SiteMessageBanner kind="facility" facilityValue={facilityValue} />
      <HomePageView categories={categories} isLoading={isLoading} facilityContext={facilityValue} />
      <SiteFooter />
    </div>
  );
}
