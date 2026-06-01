import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyBookmarkIds, toggleBookmark } from "@/lib/bookmarks.functions";

export function useBookmarks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchIds = useServerFn(getMyBookmarkIds);
  const toggleFn = useServerFn(toggleBookmark);

  const { data: bookmarkIds = new Set<string>(), isLoading } = useQuery({
    queryKey: ["my-bookmark-ids", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => new Set<string>((await fetchIds()).ids),
  });

  const toggle = async (contentItemId: string) => {
    if (!user?.id) return;
    // Optimistic update
    const wasBookmarked = bookmarkIds.has(contentItemId);
    const next = new Set(bookmarkIds);
    if (wasBookmarked) next.delete(contentItemId);
    else next.add(contentItemId);
    qc.setQueryData(["my-bookmark-ids", user.id], next);

    try {
      await toggleFn({ data: { contentItemId } });
      // Invalidate dashboard saved tab
      qc.invalidateQueries({ queryKey: ["my-bookmarked-items", user.id] });
    } catch {
      // Revert on error
      qc.setQueryData(["my-bookmark-ids", user.id], bookmarkIds);
    }
  };

  return { bookmarkIds, toggle, isLoading, isLoggedIn: !!user?.id };
}
