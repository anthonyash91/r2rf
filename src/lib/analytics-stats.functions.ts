import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAnalyticsAdmin, isFacilityScoped } from "@/lib/server-auth";

/** Strict admin-only — used for destructive/system operations like nightly refresh. */
async function assertStrictAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin access required");
}

/** Facility comparison — all facilities with pre-computed stats. */
export const getFacilityComparison = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAnalyticsAdmin(context.userId);

    const [statsRes, facRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("facility_stats")
        .select("*")
        .order("avg_completion_rate", { ascending: false, nullsFirst: false }),
      supabaseAdmin
        .from("facilities")
        .select("value, label, site_id")
        .order("label", { ascending: true }),
    ]);

    if (statsRes.error) throw new Error(statsRes.error.message);

    const labelMap = new Map<string, { label: string; siteId: string | null }>(
      (facRes.data ?? []).map((f: any) => [f.value, { label: f.label, siteId: f.site_id }])
    );

    const rows = (statsRes.data ?? []).map((r: any) => ({
      facilityValue: r.facility_value as string,
      facilityLabel: labelMap.get(r.facility_value as string)?.label ?? r.facility_value,
      facilitySiteId: labelMap.get(r.facility_value as string)?.siteId ?? null,
      activeUsers7d: r.active_users_7d as number,
      activeUsers30d: r.active_users_30d as number,
      totalUsers: r.total_users as number,
      avgCompletionRate: r.avg_completion_rate as number | null,
      totalSessionSeconds: r.total_session_seconds as number,
      itemsCompletedTotal: r.items_completed_total as number,
      updatedAt: r.updated_at as string,
      totalBookmarks: (r.bookmark_count as number) ?? 0,
      totalThumbsUp: (r.thumbs_up_count as number) ?? 0,
      totalThumbsDown: (r.thumbs_down_count as number) ?? 0,
    }));

    const updatedAt = rows[0]?.updatedAt ?? null;
    return { facilities: rows, updatedAt };
  });

/** Per-item completion stats for a category or all items. */
export const getContentItemStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ categoryId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    await assertAnalyticsAdmin(context.userId);

    let q = (supabaseAdmin as any)
      .from("content_item_stats")
      .select("content_item_id, open_count, complete_count, completion_rate, avg_session_seconds, avg_media_progress_pct, drop_off_count, updated_at");

    if (data.categoryId) {
      // Filter to items in a specific category
      const { data: itemIds } = await supabaseAdmin
        .from("content_items")
        .select("id")
        .eq("category_id", data.categoryId);
      const ids = (itemIds ?? []).map((r: any) => r.id as string);
      if (ids.length === 0) return { stats: new Map(), updatedAt: null };
      q = q.in("content_item_id", ids);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const stats = new Map<string, {
      openCount: number;
      completeCount: number;
      completionRate: number;
      avgSessionSeconds: number | null;
      avgMediaProgressPct: number | null;
      dropOffCount: number;
    }>(
      (rows ?? []).map((r: any) => [
        r.content_item_id as string,
        {
          openCount: r.open_count as number,
          completeCount: r.complete_count as number,
          completionRate: r.completion_rate as number,
          avgSessionSeconds: r.avg_session_seconds as number | null,
          avgMediaProgressPct: r.avg_media_progress_pct as number | null,
          dropOffCount: r.drop_off_count as number,
        },
      ])
    );

    const updatedAt = rows?.[0]?.updated_at ?? null;
    return { stats, updatedAt };
  });

/**
 * Retention rates, weekly growth, and program completion rates.
 * Scoped to a facility when facilityValue is provided.
 */
/**
 * Growth, retention, and program completion stats.
 * Retention + weekly growth: pre-computed nightly (acceptable staleness — daily metrics).
 * Program completion: computed live from user_content_progress (must be current).
 */
export const getGrowthStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ facilityValue: z.string().nullable().optional() }).parse(input ?? {})
  )
  .handler(async ({ context, data }) => {
    await assertAnalyticsAdmin(context.userId);

    // facilityUser callers are scoped to their own facility only (admins see all)
    let facilityValue = data.facilityValue ?? null;
    const { scoped, facility: callerFacility } = await isFacilityScoped(context.userId);
    if (scoped) {
      if (!callerFacility) throw new Error("Forbidden: no facility assigned");
      if (facilityValue && facilityValue !== callerFacility)
        throw new Error("Forbidden: user is not in your facility");
      facilityValue = callerFacility;
    }

    // Read from the three pre-computed tables populated by the nightly refresh job.
    // Previously this function scanned all user_content_progress rows in Node memory
    // to compute program completion — O(users × items). Now it's three indexed reads.
    const [retentionRes, weeklyRes, completionRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("analytics_retention")
        .select("day7_rate, day30_rate, day60_rate, total_users")
        .is("facility_value", facilityValue),
      (supabaseAdmin as any)
        .from("analytics_weekly_growth")
        .select("week_ending, signups, active_users")
        .is("facility_value", facilityValue)
        .order("week_ending", { ascending: true }),
      (supabaseAdmin as any)
        .from("analytics_program_completion")
        .select("category_id, name, total_items, users_engaged, users_completed, completion_rate")
        .is("facility_value", facilityValue)
        .gt("users_engaged", 0)
        .order("completion_rate", { ascending: false, nullsFirst: false }),
    ]);

    const programCompletion = ((completionRes.data ?? []) as any[]).map((r) => ({
      categoryId: r.category_id as string,
      name: r.name as string,
      totalItems: r.total_items as number,
      usersEngaged: r.users_engaged as number,
      usersCompleted: r.users_completed as number,
      rate: r.completion_rate as number | null,
    }));

    const ret = retentionRes.data?.[0] ?? null;

    return {
      retention: ret ? {
        day7: ret.day7_rate as number | null,
        day30: ret.day30_rate as number | null,
        day60: ret.day60_rate as number | null,
      } : null,
      weeklyData: (weeklyRes.data ?? []).map((r: any) => ({
        weekEnding: r.week_ending as string,
        signups: r.signups as number,
        activeUsers: r.active_users as number,
      })),
      programCompletion,
      totalUsers: (ret?.total_users as number) ?? 0,
    };
  });

/** User's own engagement tier for their dashboard stat card. */
export const getMyEngagementTier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (supabaseAdmin as any)
      .from("user_stats")
      .select("facility_value, facility_percentile, items_completed, items_started, total_session_seconds, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return { tier: null, percentile: null, updatedAt: null };

    const pct: number | null = data.facility_percentile;

    // Count users in their facility to decide tier vs percentile display
    const { count: facilityUserCount } = await supabaseAdmin
      .from("user_stats")
      .select("user_id", { count: "exact", head: true })
      .eq("facility_value", data.facility_value ?? "");

    // Only show the numeric percentile once there are ≥10 users in the facility;
    // below that threshold the number is too noisy to be meaningful.
    const usePercentile = (facilityUserCount ?? 0) >= 10;

    // Tier thresholds: top 20% = Top Reader, 50–80th = Active Reader,
    // 20–50th = Getting Started, below 20th = Just Joined.
    let tier: string;
    if (pct === null) {
      tier = "Getting Started";
    } else if (pct >= 80) {
      tier = "Top Reader";
    } else if (pct >= 50) {
      tier = "Active Reader";
    } else if (pct >= 20) {
      tier = "Getting Started";
    } else {
      tier = "Just Joined";
    }

    return {
      tier,
      // Suppress the numeric percentile for small facilities to avoid surfacing
      // individually identifiable data (e.g. "you are the only reader here").
      percentile: usePercentile ? pct : null,
      itemsCompleted: data.items_completed as number,
      itemsStarted: data.items_started as number,
      totalSessionSeconds: data.total_session_seconds as number,
      updatedAt: data.updated_at as string,
    };
  });


/** Manually trigger the nightly analytics refresh via db.rpc('refresh_nightly'). Admin only. */
export const triggerNightlyRefresh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStrictAdmin(context.userId);
    const { error } = await (supabaseAdmin as any).rpc("refresh_nightly");
    if (error) throw new Error(error.message);
    return { refreshedAt: new Date().toISOString() };
  });

/**
 * Clears all analytics data for a given facility and rebuilds pre-computed stats.
 * Used by testers to reset CPC Sales analytics to a clean state before testing.
 */
async function assertTesterOrAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "tester"]);
  if (!data || data.length === 0) throw new Error("Forbidden: tester or admin access required");
}

export const resetFacilityAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ facilityValue: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertTesterOrAdmin(context.userId);

    const { facilityValue } = data;

    // Get all user IDs in this facility
    const { data: profiles } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id")
      .eq("facility", facilityValue);
    const userIds = (profiles ?? []).map((p: any) => p.user_id as string);

    const db = supabaseAdmin as any;

    // Snapshot which content items these users rated/bookmarked BEFORE deletion
    // so we can recalculate the global totals tables afterward.
    let affectedRatingItemIds: string[] = [];
    let affectedBookmarkItemIds: string[] = [];
    if (userIds.length > 0) {
      const [ratingItems, bookmarkItems] = await Promise.all([
        db.from("user_content_ratings").select("content_item_id").in("user_id", userIds),
        db.from("user_content_bookmarks").select("content_item_id").in("user_id", userIds),
      ]);
      affectedRatingItemIds = [...new Set<string>((ratingItems.data ?? []).map((r: any) => r.content_item_id as string))];
      affectedBookmarkItemIds = [...new Set<string>((bookmarkItems.data ?? []).map((r: any) => r.content_item_id as string))];
    }

    if (userIds.length > 0) {
      // Clear all raw activity data for these users
      await Promise.all([
        supabaseAdmin.from("user_content_progress").delete().in("user_id", userIds),
        db.from("user_content_engagement").delete().in("user_id", userIds),
        db.from("user_content_sessions").delete().in("user_id", userIds),
        db.from("user_content_ratings").delete().in("user_id", userIds),
        db.from("user_content_bookmarks").delete().in("user_id", userIds),
        supabaseAdmin.from("user_achievements").delete().in("user_id", userIds),
        db.from("user_logins").delete().in("user_id", userIds),
        db.from("analytics_events").delete().in("user_id", userIds),
      ]);

      // Clear pre-computed stats rows for this facility's users
      await db.from("user_stats").delete().in("user_id", userIds);
    }

    // Recalculate rating and bookmark totals for affected items.
    // These tables are trigger-maintained but triggers can silently fail under
    // certain RLS configurations. We use DELETE + INSERT (not upsert) so the
    // service role write is unambiguous and doesn't depend on conflict resolution.
    if (affectedRatingItemIds.length > 0) {
      const { data: remaining } = await db
        .from("user_content_ratings")
        .select("content_item_id, rating")
        .in("content_item_id", affectedRatingItemIds);

      // Delete existing totals rows for affected items, then re-insert with correct counts.
      await db.from("content_item_rating_totals").delete().in("content_item_id", affectedRatingItemIds);

      const toInsert = affectedRatingItemIds
        .map((id) => {
          const rows = ((remaining ?? []) as any[]).filter((r: any) => r.content_item_id === id);
          return {
            content_item_id: id,
            thumbs_up: rows.filter((r: any) => r.rating === 1).length,
            thumbs_down: rows.filter((r: any) => r.rating === -1).length,
          };
        })
        .filter((r) => r.thumbs_up > 0 || r.thumbs_down > 0);

      if (toInsert.length > 0) {
        await db.from("content_item_rating_totals").insert(toInsert);
      }
    }

    if (affectedBookmarkItemIds.length > 0) {
      const { data: remaining } = await db
        .from("user_content_bookmarks")
        .select("content_item_id")
        .in("content_item_id", affectedBookmarkItemIds);

      await db.from("content_item_bookmark_totals").delete().in("content_item_id", affectedBookmarkItemIds);

      const toInsert = affectedBookmarkItemIds
        .map((id) => ({
          content_item_id: id,
          bookmark_count: ((remaining ?? []) as any[]).filter((r: any) => r.content_item_id === id).length,
        }))
        .filter((r) => r.bookmark_count > 0);

      if (toInsert.length > 0) {
        await db.from("content_item_bookmark_totals").insert(toInsert);
      }
    }

    // Clear all facility-level and event-count pre-computed stats for this facility
    await Promise.all([
      db.from("facility_stats").delete().eq("facility_value", facilityValue),
      db.from("analytics_daily_counts").delete().eq("facility_value", facilityValue),
    ]);

    // Rebuild all pre-computed stats from the now-clean raw data
    await (supabaseAdmin as any).rpc("refresh_nightly");

    return { ok: true, clearedUsers: userIds.length, facility: facilityValue };
  });
