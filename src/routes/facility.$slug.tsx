import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HomePageView } from "@/components/HomePageView";
import { SiteMessageBanner } from "@/components/SiteMessageBanner";
import { setActiveFacilitySlug } from "@/lib/facility-context";
import { setActiveInmatePin } from "@/lib/inmate-pin-context";

export const Route = createFileRoute("/facility/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    user: typeof search.user === "string" ? search.user : undefined,
  }),
  // Loader receives search params before TanStack Router normalizes the URL,
  // so the PIN is captured reliably here and passed through loaderData.
  loader: async ({ params, search }) => {
    const { data: facility, error } = await supabase
      .from("facilities")
      .select("id, value, label, site_id")
      .eq("site_id", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!facility) throw notFound();
    return {
      facilityValue: facility.value as string,
      facilityLabel: facility.label as string,
      facilitySiteId: facility.site_id as string,
      inmatePin: search?.user ?? null,
    };
  },
  component: FacilityPage,
});

function FacilityPage() {
  const { facilityValue, facilitySiteId, inmatePin } = Route.useLoaderData();
  const prevFacilityRef = useRef<string | null>(null);

  useEffect(() => {
    const facilityChanged = prevFacilityRef.current !== facilitySiteId;
    prevFacilityRef.current = facilitySiteId;

    setActiveFacilitySlug(facilitySiteId);

    if (inmatePin) {
      // PIN present in loader data — always store it
      setActiveInmatePin(inmatePin);
    } else if (facilityChanged) {
      // Visiting a genuinely different facility with no PIN — clear it
      setActiveInmatePin(null);
    }
    // If same facility and inmatePin is null (router stripped the URL param
    // and re-ran the loader), leave the stored PIN untouched.
  }, [facilitySiteId, inmatePin]);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["facility-categories", facilityValue],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Category[]> => {
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
