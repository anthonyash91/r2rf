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
export const getGrowthStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ facilityValue: z.string().nullable().optional() }).parse(input ?? {})
  )
  .handler(async ({ context, data }) => {
    await assertAnyAdmin(context.userId);
    const facilityValue = data.facilityValue ?? null;

    // Exclude staff from all metrics
    const { data: staffRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "contributor", "tester", "facilityUser"]);
    const staffIds = new Set<string>((staffRoles ?? []).map((r: any) => r.user_id as string));

    // Real users (non-staff, non-synthetic, optionally scoped to facility)
    let usersQ = supabaseAdmin
      .from("user_profiles")
      .select("user_id, created_at")
      .eq("is_synthetic", false);
    if (facilityValue) usersQ = (usersQ as any).eq("facility", facilityValue);
    const { data: usersData } = await usersQ;
    const realUsers = (usersData ?? []).filter((u: any) => !staffIds.has(u.user_id as string));
    const realUserIds = new Set<string>(realUsers.map((u: any) => u.user_id as string));

    if (realUserIds.size === 0) {
      return {
        retention: { day7: null, day30: null, day60: null },
        weeklyData: [],
        programCompletion: [],
        totalUsers: 0,
      };
    }

    const now = new Date();
    const twelveWeeksAgo = new Date(now);
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    // Fetch logins, recent events, completions, and content in parallel
    const [loginsRes, eventsRes, completionsRes, itemsRes, catsRes] = await Promise.all([
      supabaseAdmin
        .from("user_logins")
        .select("user_id, login_date")
        .in("user_id", [...realUserIds]),
      supabaseAdmin
        .from("analytics_events")
        .select("user_id, created_at")
        .gte("created_at", twelveWeeksAgo.toISOString())
        .not("user_id", "is", null),
      supabaseAdmin
        .from("user_content_progress")
        .select("user_id, content_item_id"),
      supabaseAdmin
        .from("content_items")
        .select("id, category_id")
        .eq("published", true),
      supabaseAdmin
        .from("categories")
        .select("id, name")
        .eq("published", true),
    ]);

    // ── Retention ────────────────────────────────────────────────────────────
    const loginsByUser = new Map<string, string[]>();
    for (const r of (loginsRes.data ?? []) as any[]) {
      const arr = loginsByUser.get(r.user_id as string) ?? [];
      arr.push(r.login_date as string);
      loginsByUser.set(r.user_id as string, arr);
    }

    const computeRetention = (days: number): number | null => {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      const eligible = realUsers.filter((u: any) => new Date(u.created_at) < cutoff);
      if (eligible.length === 0) return null;
      const returned = eligible.filter((u: any) => {
        const signupDate = new Date(u.created_at).toISOString().slice(0, 10);
        return (loginsByUser.get(u.user_id as string) ?? []).some((loginDate) => {
          if (loginDate <= signupDate) return false;
          const diff = (new Date(loginDate).getTime() - new Date(signupDate).getTime()) / 86400000;
          return diff <= days;
        });
      });
      return Math.round((returned.length / eligible.length) * 100);
    };

    // ── Weekly data (last 12 weeks) ──────────────────────────────────────────
    const weeklyData: { weekEnding: string; signups: number; activeUsers: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      weekEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const signups = realUsers.filter((u: any) => {
        const d = new Date(u.created_at);
        return d >= weekStart && d <= weekEnd;
      }).length;

      const activeSet = new Set<string>();
      for (const e of (eventsRes.data ?? []) as any[]) {
        const d = new Date(e.created_at as string);
        if (d >= weekStart && d <= weekEnd && e.user_id && realUserIds.has(e.user_id as string)) {
          activeSet.add(e.user_id as string);
        }
      }

      weeklyData.push({ weekEnding: weekEnd.toISOString().slice(0, 10), signups, activeUsers: activeSet.size });
    }

    // ── Program completion ───────────────────────────────────────────────────
    const catItems = new Map<string, string[]>();
    for (const item of (itemsRes.data ?? []) as any[]) {
      const arr = catItems.get(item.category_id as string) ?? [];
      arr.push(item.id as string);
      catItems.set(item.category_id as string, arr);
    }

    const userCompletions = new Map<string, Set<string>>();
    for (const c of (completionsRes.data ?? []) as any[]) {
      if (!realUserIds.has(c.user_id as string)) continue;
      const s = userCompletions.get(c.user_id as string) ?? new Set<string>();
      s.add(c.content_item_id as string);
      userCompletions.set(c.user_id as string, s);
    }

    const programCompletion: {
      categoryId: string; name: string; totalItems: number;
      usersEngaged: number; usersCompleted: number; rate: number | null;
    }[] = [];

    for (const cat of (catsRes.data ?? []) as any[]) {
      const items = catItems.get(cat.id as string) ?? [];
      if (items.length === 0) continue;
      let usersEngaged = 0, usersCompleted = 0;
      for (const [, completed] of userCompletions.entries()) {
        if (!items.some((id) => completed.has(id))) continue;
        usersEngaged++;
        if (items.every((id) => completed.has(id))) usersCompleted++;
      }
      programCompletion.push({
        categoryId: cat.id as string,
        name: cat.name as string,
        totalItems: items.length,
        usersEngaged,
        usersCompleted,
        rate: usersEngaged > 0 ? Math.round((usersCompleted / usersEngaged) * 100) : null,
      });
    }
    programCompletion.sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

    return {
      retention: { day7: computeRetention(7), day30: computeRetention(30), day60: computeRetention(60) },
      weeklyData,
      programCompletion,
      totalUsers: realUserIds.size,
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
