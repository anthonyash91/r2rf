import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyBookmarkIds, toggleBookmark } from "@/lib/bookmarks.functions";
import { QK } from "@/lib/query-keys";

export function useBookmarks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchIds = useServerFn(getMyBookmarkIds);
  const toggleFn = useServerFn(toggleBookmark);

  const { data: bookmarkIds = new Set<string>(), isLoading } = useQuery({
    queryKey: QK.myBookmarkIds(user?.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => new Set<string>((await fetchIds()).ids),
  });

  const toggle = async (contentItemId: string) => {
    if (!user?.id) return;
    // Optimistic update: flip the local Set immediately so the bookmark icon
    // responds without waiting for the server round-trip.
    const wasBookmarked = bookmarkIds.has(contentItemId);
    const next = new Set(bookmarkIds);
    if (wasBookmarked) next.delete(contentItemId);
    else next.add(contentItemId);
    qc.setQueryData(QK.myBookmarkIds(user.id), next);

    try {
      await toggleFn({ data: { contentItemId } });
      // Invalidate the full bookmarked-items list so the dashboard "Saved" tab
      // reflects the change (that query fetches full item data, not just ids).
      qc.invalidateQueries({ queryKey: QK.myBookmarkedItems(user.id) });
    } catch {
      // Server write failed — revert to the pre-optimistic state.
      qc.setQueryData(QK.myBookmarkIds(user.id), bookmarkIds);
    }
  };

  return { bookmarkIds, toggle, isLoading, isLoggedIn: !!user?.id };
}
