import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/lib/categories";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { HomePageView } from "@/components/HomePageView";
import { SiteMessageBanner } from "@/components/SiteMessageBanner";
import { useAuth } from "@/hooks/use-auth";
import { getMyFacilityValue } from "@/lib/user-signup.functions";

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
  const { user, isFacilityUser, rolesLoaded } = useAuth();
  const navigate = useNavigate();
  const fetchMyFacility = useServerFn(getMyFacilityValue);

  const { data: facilityData } = useQuery({
    queryKey: ["my-facility", user?.id],
    enabled: rolesLoaded && isFacilityUser && !!user?.id,
    staleTime: Infinity,
    queryFn: () => fetchMyFacility(),
  });

  useEffect(() => {
    const slug = facilityData?.slug;
    if (rolesLoaded && isFacilityUser && slug) {
      navigate({ to: "/facility/$slug", params: { slug }, replace: true });
    }
  }, [rolesLoaded, isFacilityUser, facilityData, navigate]);

  if (isFacilityUser) return null;

  return <IndexContent />;
}

function IndexContent() {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories", "public"],
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
      <SiteMessageBanner kind="facility" />
      <HomePageView categories={categories} isLoading={isLoading} />
      <SiteFooter />
    </div>
  );
}
