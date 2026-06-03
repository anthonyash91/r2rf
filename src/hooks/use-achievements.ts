import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { checkAndGrantAchievements } from "@/lib/achievements.functions";
import { ACHIEVEMENTS } from "@/lib/achievements";

export function useAchievements() {
  const { user, isUser } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const checkFn = useServerFn(checkAndGrantAchievements);

  // Runs on first render (and after staleTime expires). The server fn both checks
  // for newly earned achievements and returns the full earned set in one call.
  const { data } = useQuery({
    queryKey: ["my-achievements", user?.id],
    enabled: !!user?.id && isUser,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const result = await checkFn();
      // Toast each newly-earned achievement individually so the user sees them
      // one at a time rather than a single combined message.
      if (result.newlyEarned.length > 0) {
        for (const key of result.newlyEarned) {
          const a = ACHIEVEMENTS.find((x) => x.key === key);
          if (a) {
            const title = t(`achievement.${a.key}.title` as any);
            const desc = t(`achievement.${a.key}.desc` as any);
            toast.success(`🏆 ${t("achievement.toast" as any, { title })}`, {
              description: desc,
              duration: 5000,
            });
          }
        }
      }
      return result.earned;
    },
  });

  // `check()` is called after actions that might unlock achievements (e.g. marking an item
  // complete). Invalidating forces a fresh server-fn call on the next render.
  const check = async () => {
    if (!user?.id || !isUser) return;
    await qc.invalidateQueries({ queryKey: ["my-achievements", user.id] });
  };

  return {
    earned: data ?? {} as Record<string, string>,
    check,
  };
}
