import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_BADGE_STYLES, mergeBadgeStyles, type BadgeStyles } from "@/lib/badge-styles";

export const BADGE_STYLES_KEY = "badge_styles";
export const badgeStylesQueryKey = ["site_settings", BADGE_STYLES_KEY] as const;

export async function fetchBadgeStyles(): Promise<BadgeStyles> {
  const { data } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", BADGE_STYLES_KEY)
    .maybeSingle();
  return mergeBadgeStyles(data?.value);
}

export function useBadgeStyles(): BadgeStyles {
  const { data } = useQuery({
    queryKey: badgeStylesQueryKey,
    queryFn: fetchBadgeStyles,
    staleTime: 5 * 60 * 1000,
    // placeholderData (not initialData) so defaults are shown while loading
    // without being written into the cache — the real data replaces it once fetched.
    placeholderData: DEFAULT_BADGE_STYLES,
  });
  return data ?? DEFAULT_BADGE_STYLES;
}
