import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { checkAndGrantAchievements } from "@/lib/achievements.functions";
import { ACHIEVEMENTS } from "@/lib/achievements";

export function useAchievements() {
  const { user, isUser } = useAuth();
  const qc = useQueryClient();
  const checkFn = useServerFn(checkAndGrantAchievements);

  // On first call (or after staleTime), check for new achievements and cache the result.
  const { data } = useQuery({
    queryKey: ["my-achievements", user?.id],
    enabled: !!user?.id && isUser,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const result = await checkFn();
      if (result.newlyEarned.length > 0) {
        for (const key of result.newlyEarned) {
          const a = ACHIEVEMENTS.find((x) => x.key === key);
          if (a) {
            toast.success(`🏆 Achievement unlocked: ${a.title}`, {
              description: a.description,
              duration: 5000,
            });
          }
        }
      }
      return result.earned;
    },
  });

  // Call this after any action that might unlock achievements (e.g. marking an item complete).
  const check = async () => {
    if (!user?.id || !isUser) return;
    // Force a fresh check by removing the cached data.
    await qc.invalidateQueries({ queryKey: ["my-achievements", user.id] });
  };

  return {
    earned: data ?? {} as Record<string, string>,
    check,
  };
}
