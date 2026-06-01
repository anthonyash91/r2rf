import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyRatings, rateItem } from "@/lib/ratings.functions";
import { toast } from "sonner";

export function useRatings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchMyRatings = useServerFn(getMyRatings);
  const rateItemFn = useServerFn(rateItem);

  const { data: myRatings = new Map<string, 1 | -1>() } = useQuery({
    queryKey: ["my-ratings", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { ratings } = await fetchMyRatings();
      return new Map(Object.entries(ratings) as [string, 1 | -1][]);
    },
  });

  const rate = async (contentItemId: string, rating: 1 | -1 | null) => {
    if (!user?.id) return;
    const prev = myRatings.get(contentItemId);
    const next = new Map(myRatings);
    if (rating === null) next.delete(contentItemId);
    else next.set(contentItemId, rating);
    qc.setQueryData(["my-ratings", user.id], next);

    try {
      await rateItemFn({ data: { contentItemId, rating } });
      qc.invalidateQueries({ queryKey: ["rating-totals"] });
    } catch (err: any) {
      const revert = new Map(myRatings);
      if (prev === undefined) revert.delete(contentItemId);
      else revert.set(contentItemId, prev);
      qc.setQueryData(["my-ratings", user.id], revert);
      toast.error(err?.message ?? "Couldn't save your rating.");
    }
  };

  return { myRatings, rate, isLoggedIn: !!user?.id };
}
