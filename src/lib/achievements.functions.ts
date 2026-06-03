import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CHECKS } from "@/lib/achievements";

export const checkAndGrantAchievements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    const [progressRes, engagementRes, loginsRes, allItemsRes, earnedRes] = await Promise.all([
      supabaseAdmin
        .from("user_content_progress")
        .select("content_item_id, category_id")
        .eq("user_id", userId),
      (supabaseAdmin as any)
        .from("user_content_engagement")
        .select("session_seconds")
        .eq("user_id", userId),
      supabaseAdmin
        .from("user_logins")
        .select("login_date")
        .eq("user_id", userId),
      supabaseAdmin
        .from("content_items")
        .select("id, category_id, exempt_from_progress")
        .eq("published", true),
      (supabaseAdmin as any)
        .from("user_achievements")
        .select("achievement_key, earned_at")
        .eq("user_id", userId),
    ]);

    // Build set of exempt item IDs so they're excluded from all achievement counts
    const exemptItemIds = new Set<string>(
      (allItemsRes.data ?? []).filter((r: any) => r.exempt_from_progress).map((r: any) => r.id as string),
    );
    const nonExemptProgress = (progressRes.data ?? []).filter((r: any) => !exemptItemIds.has(r.content_item_id as string));

    // Items completed (excluding exempt items)
    const itemsCompleted = nonExemptProgress.length;

    // Categories started (excluding exempt items)
    const startedCatIds = new Set(nonExemptProgress.map((r: any) => r.category_id as string));
    const categoriesStarted = startedCatIds.size;

    // Programs completed: user has read every non-exempt published item in a category
    const completedByCat: Record<string, number> = {};
    for (const r of nonExemptProgress) {
      completedByCat[r.category_id] = (completedByCat[r.category_id] ?? 0) + 1;
    }
    const totalByCat: Record<string, number> = {};
    for (const r of (allItemsRes.data ?? []) as any[]) {
      if (!r.exempt_from_progress) {
        totalByCat[r.category_id] = (totalByCat[r.category_id] ?? 0) + 1;
      }
    }
    const programsCompleted = Object.keys(completedByCat).filter(
      (catId) => totalByCat[catId] > 0 && completedByCat[catId] >= totalByCat[catId],
    ).length;

    // Total active session time
    const totalSeconds = (engagementRes.data ?? []).reduce(
      (sum: number, r: any) => sum + ((r.session_seconds as number) || 0), 0,
    );

    // Current login streak (consecutive days ending today or yesterday).
    // startOffset=0: streak starts today. startOffset=1: the user logged in
    // yesterday but not yet today — streak is still active. null: no recent
    // login, so streak is 0 regardless of history.
    const loginDates = new Set((loginsRes.data ?? []).map((r: any) => r.login_date as string));
    let streak = 0;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    const startOffset = loginDates.has(todayStr) ? 0 : loginDates.has(yest.toISOString().slice(0, 10)) ? 1 : null;
    if (startOffset !== null) {
      for (let i = startOffset; i < 400; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        if (loginDates.has(d.toISOString().slice(0, 10))) streak++;
        else break;
      }
    }

    const stats = { itemsCompleted, categoriesStarted, programsCompleted, totalSeconds, streak };

    // Determine newly earned achievements
    const alreadyEarned = new Map<string, string>(
      (earnedRes.data ?? []).map((r: any) => [r.achievement_key as string, r.earned_at as string]),
    );

    const newlyEarned: string[] = [];
    for (const [key, check] of Object.entries(CHECKS)) {
      if (!alreadyEarned.has(key) && check(stats)) {
        newlyEarned.push(key);
      }
    }

    if (newlyEarned.length > 0) {
      await (supabaseAdmin as any).from("user_achievements").insert(
        newlyEarned.map((key) => ({ user_id: userId, achievement_key: key })),
      );
    }

    const allEarned: Record<string, string> = {};
    for (const [key, earnedAt] of alreadyEarned) allEarned[key] = earnedAt;
    const now = new Date().toISOString();
    for (const key of newlyEarned) allEarned[key] = now;

    return { newlyEarned, earned: allEarned };
  });
