import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QK } from "@/lib/query-keys";
import { getPlatformIdentity } from "@/lib/platform-identity.functions";

// Resolves the facility slug and resident PIN for this page load. The
// app-platform header (x-facility-id/x-resident-id) wins when present;
// otherwise falls back to the ?site=/?user= URL params passed in.
export function usePlatformIdentity(searchSite?: string, searchUser?: string) {
  const fetchIdentity = useServerFn(getPlatformIdentity);
  const { data } = useQuery({
    queryKey: QK.platformIdentity,
    queryFn: () => fetchIdentity(),
    staleTime: Infinity,
  });

  return {
    site: data?.facilityId ?? searchSite,
    inmatePin: data?.residentId ?? searchUser,
  };
}
