import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { QK } from "@/lib/query-keys";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HomePageView } from "@/components/HomePageView";
import { SiteMessageBanner } from "@/components/SiteMessageBanner";
import { useAuth } from "@/hooks/use-auth";
import { getMyFacilityValue } from "@/lib/user-signup.functions";
import { useServerFn } from "@tanstack/react-start";
import { setActiveFacilitySlug } from "@/lib/facility-context";
import { setActiveInmatePin } from "@/lib/inmate-pin-context";

export const Route = createFileRoute("/")({
  validateSearch: z.object({
    site: z.coerce.string().optional(),
    user: z.coerce.string().optional(),
    language: z.coerce.string().optional(),
  }),
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
  const { user, isFacilityUser, rolesLoaded } = useAuth();
  const navigate = useNavigate();
  const fetchMyFacility = useServerFn(getMyFacilityValue);
  const { data: facilityData } = useQuery({
    queryKey: QK.myFacility(user?.id),
    enabled: rolesLoaded && isFacilityUser && !!user?.id,
    staleTime: Infinity,
    queryFn: () => fetchMyFacility(),
  });

  useEffect(() => {
    const slug = facilityData?.slug;
    // Redirect facilityUser admins to their facility's home page so they see
    // the scoped view. `replace: true` avoids a back-button loop back to "/".
    if (rolesLoaded && isFacilityUser && slug) {
      navigate({ to: "/facility/$slug", params: { slug }, replace: true });
    }
  }, [rolesLoaded, isFacilityUser, facilityData, navigate]);

  // Show a spinner while the redirect is pending so there's no blank flash
  // before the facilityUser is sent to their facility page.
  if (isFacilityUser) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return <IndexContent />;
}

function IndexContent() {
  const { site, user: inmatePin } = Route.useSearch();

  // Look up facility by ?site= param
  const { data: siteFacility } = useQuery({
    queryKey: QK.facilityBySiteParam(site ?? null),
    enabled: !!site,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("facilities")
        .select("value, label, site_id")
        .eq("site_id", site!)
        .maybeSingle();
      return data ?? null;
    },
  });

  // Set active facility + inmate PIN contexts (same logic as /facility/$slug)
  useEffect(() => {
    if (!site) return;
    if (!siteFacility) return;

    const prevSlug = typeof window !== "undefined"
      ? window.sessionStorage.getItem("active-facility-slug")
      : null;

    setActiveFacilitySlug(siteFacility.site_id as string);

    if (inmatePin) {
      setActiveInmatePin(inmatePin);
    } else if (prevSlug !== null && prevSlug !== siteFacility.site_id) {
      setActiveInmatePin(null);
    }
  }, [siteFacility, site, inmatePin]);

  const facilityValue = siteFacility?.value as string | undefined;

  const { data: categories = [], isLoading } = useQuery({
    queryKey: QK.categoriesPublic(facilityValue ?? "all"),
    staleTime: 10 * 60 * 1000,
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
      <SiteMessageBanner kind="facility" facilityValue={facilityValue} />
      <HomePageView categories={categories} isLoading={isLoading} facilityContext={facilityValue} />
      <SiteFooter />
    </div>
  );
}
