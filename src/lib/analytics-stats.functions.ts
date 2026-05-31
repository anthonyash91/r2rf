import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAnyAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "contributor", "facilityUser"])
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin access required");
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

/** Facility comparison — all facilities with pre-computed stats. */
export const getFacilityComparison = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAnyAdmin(context.userId);

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
    await assertAnyAdmin(context.userId);

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
 * Reads pre-computed growth/retention/program-completion stats from nightly tables.
 * Scoped by facility when facilityValue is provided.
 * All heavy computation now runs in refresh_analytics_stats() — not in the request path.
 */
export const getGrowthStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ facilityValue: z.string().nullable().optional() }).parse(input ?? {})
  )
  .handler(async ({ context, data }) => {
    await assertAnyAdmin(context.userId);
    const facilityValue = data.facilityValue ?? null;

    const [retentionRes, weeklyRes, programRes] = await Promise.all([
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
        .order("completion_rate", { ascending: false, nullsFirst: false }),
    ]);

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
      programCompletion: (programRes.data ?? []).map((r: any) => ({
        categoryId: r.category_id as string,
        name: r.name as string,
        totalItems: r.total_items as number,
        usersEngaged: r.users_engaged as number,
        usersCompleted: r.users_completed as number,
        rate: r.completion_rate as number | null,
      })),
      totalUsers: (ret?.total_users as number) ?? 0,
    };
  });

/** User's own engagement tier for their dashboard stat card. */
export const getMyEngagementTier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (supabaseAdmin as any)
      .from("user_stats")
      .select("facility_percentile, items_completed, items_started, total_session_seconds, updated_at")
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

    const usePercentile = (facilityUserCount ?? 0) >= 10;

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
      percentile: usePercentile ? pct : null,
      itemsCompleted: data.items_completed as number,
      itemsStarted: data.items_started as number,
      totalSessionSeconds: data.total_session_seconds as number,
      updatedAt: data.updated_at as string,
    };
  });
