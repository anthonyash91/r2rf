import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyRatings, rateItem } from "@/lib/ratings.functions";
import { QK } from "@/lib/query-keys";
import { toast } from "sonner";

export function useRatings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchMyRatings = useServerFn(getMyRatings);
  const rateItemFn = useServerFn(rateItem);

  const { data: myRatings = new Map<string, 1 | -1>() } = useQuery({
    queryKey: QK.myRatings(user?.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { ratings } = await fetchMyRatings();
      return new Map(Object.entries(ratings) as [string, 1 | -1][]);
    },
  });

  const rate = async (contentItemId: string, rating: 1 | -1 | null) => {
    if (!user?.id) return;
    // Capture the previous rating before mutating so we can revert on error.
    const prev = myRatings.get(contentItemId);
    // Optimistic update: clone the Map and apply the change immediately.
    const next = new Map(myRatings);
    if (rating === null) next.delete(contentItemId);
    else next.set(contentItemId, rating);
    qc.setQueryData(QK.myRatings(user.id), next);

    try {
      await rateItemFn({ data: { contentItemId, rating } });
      // Invalidate aggregate totals so like/dislike counts shown to all users refresh.
      qc.invalidateQueries({ queryKey: QK.ratingTotals });
    } catch (err: any) {
      // Revert to the pre-optimistic state. `prev === undefined` means the item
      // had no prior rating, so we delete rather than restore a stale value.
      const revert = new Map(myRatings);
      if (prev === undefined) revert.delete(contentItemId);
      else revert.set(contentItemId, prev);
      qc.setQueryData(QK.myRatings(user.id), revert);
      toast.error(err?.message ?? "Couldn't save your rating.");
    }
  };

  return { myRatings, rate, isLoggedIn: !!user?.id };
}
