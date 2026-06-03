import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Analytics access: admin and facilityUser only — contributors excluded. */
async function assertAnalyticsAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "facilityUser"])
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: analytics admin access required");
}

// Fetches exempt IDs as a plain array so we can use NOT IN syntax in
// progress queries. PostgREST embedded-resource filters (content_items!inner)
// don't work reliably in count-only queries, causing silent 0 results.
async function fetchExemptItemIds(db: any): Promise<string[]> {
  const { data } = await db.from("content_items").select("id").eq("exempt_from_progress", true);
  return (data ?? []).map((r: any) => r.id as string);
}

export const getMyMonthlySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as any;
    const now = new Date();

    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const exemptIds = await fetchExemptItemIds(db);

    const buildProgressQuery = (since: string, until?: string) => {
      let q = db.from("user_content_progress")
        .select("content_item_id", { count: "exact", head: true })
        .gte("created_at", since);
      if (until) q = q.lt("created_at", until);
      if (exemptIds.length > 0) q = q.not("content_item_id", "in", `(${exemptIds.join(",")})`);
      return q;
    };

    const [
      thisProgressRes,
      lastProgressRes,
      thisTimeRes,
      lastTimeRes,
      thisAchievementsRes,
    ] = await Promise.all([
      buildProgressQuery(firstOfThisMonth),
      buildProgressQuery(firstOfLastMonth, firstOfThisMonth),
      db.from("user_content_sessions")
        .select("session_seconds")
        .gte("recorded_at", firstOfThisMonth),
      db.from("user_content_sessions")
        .select("session_seconds")
        .gte("recorded_at", firstOfLastMonth)
        .lt("recorded_at", firstOfThisMonth),
      db.from("user_achievements")
        .select("achievement_key")
        .gte("earned_at", firstOfThisMonth),
    ]);

    const itemsThisMonth = thisProgressRes.count ?? 0;
    const itemsLastMonth = lastProgressRes.count ?? 0;

    const secondsThisMonth = ((thisTimeRes.data ?? []) as any[])
      .reduce((s: number, r: any) => s + (r.session_seconds || 0), 0);
    const secondsLastMonth = ((lastTimeRes.data ?? []) as any[])
      .reduce((s: number, r: any) => s + (r.session_seconds || 0), 0);

    const achievementKeysThisMonth: string[] = ((thisAchievementsRes.data ?? []) as any[])
      .map((r: any) => r.achievement_key as string);
    const achievementsThisMonth = achievementKeysThisMonth.length;

    const hasActivity = itemsThisMonth > 0 || secondsThisMonth > 0;

    return {
      hasActivity,
      itemsThisMonth,
      itemsLastMonth,
      secondsThisMonth,
      secondsLastMonth,
      achievementsThisMonth,
      achievementKeysThisMonth,
      monthIndex: now.getMonth(),
      year: now.getFullYear(),
      dayOfMonth: now.getDate(),
    };
  });

/** Admin version — fetches monthly summary for any user by ID using supabaseAdmin. */
export const getAdminUserMonthlySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAnalyticsAdmin(context.userId);
    const now = new Date();
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    const exemptIds = await fetchExemptItemIds(supabaseAdmin as any);

    const buildProgressQuery = (since: string, until?: string) => {
      let q = (supabaseAdmin as any).from("user_content_progress")
        .select("content_item_id", { count: "exact", head: true })
        .eq("user_id", data.userId)
        .gte("created_at", since);
      if (until) q = q.lt("created_at", until);
      if (exemptIds.length > 0) q = q.not("content_item_id", "in", `(${exemptIds.join(",")})`);
      return q;
    };

    const [thisProgress, lastProgress, thisTime, lastTime, thisAchievements] = await Promise.all([
      buildProgressQuery(firstOfThisMonth),
      buildProgressQuery(firstOfLastMonth, firstOfThisMonth),
      (supabaseAdmin as any).from("user_content_sessions")
        .select("session_seconds")
        .eq("user_id", data.userId)
        .gte("recorded_at", firstOfThisMonth),
      (supabaseAdmin as any).from("user_content_sessions")
        .select("session_seconds")
        .eq("user_id", data.userId)
        .gte("recorded_at", firstOfLastMonth)
        .lt("recorded_at", firstOfThisMonth),
      (supabaseAdmin as any).from("user_achievements")
        .select("achievement_key")
        .eq("user_id", data.userId)
        .gte("earned_at", firstOfThisMonth),
    ]);

    const itemsThisMonth = thisProgress.count ?? 0;
    const itemsLastMonth = lastProgress.count ?? 0;
    const secondsThisMonth = ((thisTime.data ?? []) as any[]).reduce((s: number, r: any) => s + (r.session_seconds || 0), 0);
    const secondsLastMonth = ((lastTime.data ?? []) as any[]).reduce((s: number, r: any) => s + (r.session_seconds || 0), 0);
    const achievementKeysThisMonth: string[] = ((thisAchievements.data ?? []) as any[])
      .map((r: any) => r.achievement_key as string);
    const achievementsThisMonth = achievementKeysThisMonth.length;

    return {
      itemsThisMonth,
      itemsLastMonth,
      secondsThisMonth,
      secondsLastMonth,
      achievementsThisMonth,
      achievementKeysThisMonth,
      monthIndex: now.getMonth(),
      year: now.getFullYear(),
    };
  });
