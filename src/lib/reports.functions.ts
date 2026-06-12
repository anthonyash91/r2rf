import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseMinutes } from "@/lib/duration";
import { assertAnalyticsAdmin, isFacilityScoped } from "@/lib/server-auth";

/** Chunk a large ID array so each slice stays under Supabase's URL length limit. */
function chunkIds(ids: string[], size = 500): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

const RangeSchema = z.enum(["7d", "30d", "90d", "all", "month"]);

type ExclusionContext = {
  staffUserIds: Set<string>;
  syntheticIds: Set<string>;
};

async function fetchDailyCounts(sinceIso: string | null, facilityValue: string | null) {
  let q = (supabaseAdmin as any)
    .from("analytics_daily_counts")
    .select("event_type, category_id, content_id, count")
    .range(0, 49999);
  if (sinceIso) q = q.gte("period_date", sinceIso.slice(0, 10));
  if (facilityValue) q = q.eq("facility_value", facilityValue);
  return q;
}

async function fetchOpenersData(
  userIdFilter: string[] | null,
  sinceIso: string | null,
  ctx: ExclusionContext,
): Promise<{ precomputed: boolean; rows: any[] }> {
  if (userIdFilter === null && !sinceIso) {
    const { data } = await (supabaseAdmin as any)
      .from("content_item_openers")
      .select("content_item_id, opener_count")
      .range(0, 4999);
    return { precomputed: true, rows: data ?? [] };
  }
  if (userIdFilter !== null && userIdFilter.length === 0) {
    return { precomputed: false, rows: [] };
  }
  if (userIdFilter !== null) {
    // Chunk large facility user lists to stay under URL length limits
    const chunkRows = await Promise.all(chunkIds(userIdFilter).map(async (chunk) => {
      const PAGE = 1000; const rows: any[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = supabaseAdmin.from("analytics_events").select("user_id, content_id")
          .eq("event_type", "content_click").not("user_id", "is", null)
          .range(from, from + PAGE - 1);
        if (sinceIso) q = (q as any).gte("created_at", sinceIso);
        const { data } = await (q as any).in("user_id", chunk);
        if (!data?.length) break;
        rows.push(...data);
        if (data.length < PAGE) break;
      }
      return rows;
    }));
    return { precomputed: false, rows: chunkRows.flat() };
  }
  // Overall + date filter: paginate with staff exclusion
  const excludeAll = [
    ...Array.from(ctx.staffUserIds),
    ...Array.from(ctx.syntheticIds),
    "00000000-0000-0000-0000-000000000000",
  ];
  const PAGE = 1000; const allRows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabaseAdmin.from("analytics_events").select("user_id, content_id")
      .eq("event_type", "content_click").not("user_id", "is", null)
      .range(from, from + PAGE - 1);
    if (sinceIso) q = (q as any).gte("created_at", sinceIso);
    if (excludeAll.length > 0) q = (q as any).not("user_id", "in", `(${excludeAll.join(",")})`);
    const { data } = await q;
    if (!data?.length) break;
    allRows.push(...data);
    if (data.length < PAGE) break;
  }
  return { precomputed: false, rows: allRows };
}

async function fetchTimeData(
  userIdFilter: string[] | null,
  sinceIso: string | null,
  ctx: ExclusionContext,
): Promise<{ precomputed: boolean; rows: any[] }> {
  // Fast path: all-time overall view — single indexed query
  if (userIdFilter === null && !sinceIso) {
    const { data } = await (supabaseAdmin as any)
      .from("content_item_time_totals")
      .select("content_item_id, total_session_seconds, engager_count")
      .range(0, 4999);
    return { precomputed: true, rows: data ?? [] };
  }
  if (userIdFilter !== null && userIdFilter.length === 0) {
    return { precomputed: false, rows: [] };
  }
  // Facility scope: chunk user IDs, fetch all sessions in parallel
  if (userIdFilter !== null) {
    const chunkRows = await Promise.all(chunkIds(userIdFilter).map(async (chunk) => {
      const PAGE = 1000; const rows: any[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = (supabaseAdmin as any).from("user_content_sessions")
          .select("user_id, content_item_id, session_seconds")
          .in("user_id", chunk).range(from, from + PAGE - 1);
        if (sinceIso) q = q.gte("recorded_at", sinceIso);
        const { data, error } = await q;
        if (error || !data || data.length === 0) break;
        rows.push(...data); if (data.length < PAGE) break;
      }
      return rows;
    }));
    return { precomputed: false, rows: chunkRows.flat() };
  }
  // Overall date-filtered: paginate with staff exclusion
  const excludeAll = [
    ...Array.from(ctx.staffUserIds),
    ...Array.from(ctx.syntheticIds),
    "00000000-0000-0000-0000-000000000000",
  ];
  const PAGE = 1000; const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = (supabaseAdmin as any)
      .from("user_content_sessions")
      .select("user_id, content_item_id, session_seconds")
      .range(from, from + PAGE - 1);
    if (sinceIso) q = q.gte("recorded_at", sinceIso);
    if (excludeAll.length > 0) q = q.not("user_id", "in", `(${excludeAll.join(",")})`);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all.push(...data); if (data.length < PAGE) break;
  }
  return { precomputed: false, rows: all };
}

async function fetchAllProgress(
  userIdFilter: string[] | null,
  sinceIso: string | null,
  ctx: ExclusionContext,
  exemptItemIds: string[],
): Promise<any[]> {
  if (userIdFilter !== null) {
    if (userIdFilter.length === 0) return [];
    const chunkRows = await Promise.all(chunkIds(userIdFilter).map(async (chunk) => {
      const PAGE = 1000; const rows: any[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = (supabaseAdmin as any).from("user_content_progress")
          .select("content_item_id, user_id")
          .in("user_id", chunk).range(from, from + PAGE - 1);
        if (sinceIso) q = q.gte("created_at", sinceIso);
        if (exemptItemIds.length > 0) q = q.not("content_item_id", "in", `(${exemptItemIds.join(",")})`);
        const { data, error } = await q;
        if (error || !data || data.length === 0) break;
        rows.push(...data); if (data.length < PAGE) break;
      }
      return rows;
    }));
    return chunkRows.flat();
  }
  // Overall: paginate with staff exclusion
  const excludeAll = [
    ...Array.from(ctx.staffUserIds),
    ...Array.from(ctx.syntheticIds),
    "00000000-0000-0000-0000-000000000000",
  ];
  const PAGE = 1000; const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = (supabaseAdmin as any)
      .from("user_content_progress")
      .select("content_item_id, user_id")
      .range(from, from + PAGE - 1);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    if (exemptItemIds.length > 0) q = q.not("content_item_id", "in", `(${exemptItemIds.join(",")})`);
    if (excludeAll.length > 0) q = q.not("user_id", "in", `(${excludeAll.join(",")})`);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    all.push(...data); if (data.length < PAGE) break;
  }
  return all;
}

function sinceIsoFor(range: z.infer<typeof RangeSchema>): string | null {
  if (range === "month") {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1).toISOString();
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : null;
  if (days === null) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Overall + facility-scoped report. When facilityValue is provided, only
 * events authored by users belonging to that facility are included.
 */
export const getUsageReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        range: RangeSchema,
        facilityValue: z.string().min(1).max(64).nullable().optional(),
      })
      .parse(input),
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

    const sinceIso = sinceIsoFor(data.range);

    // Always exclude synthetic (test) users from real-user metrics.
    const { data: synthRows, error: synthErr } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id")
      .eq("is_synthetic", true);
    if (synthErr) throw new Error(synthErr.message);
    const syntheticIds = new Set<string>((synthRows ?? []).map((r: any) => r.user_id as string));

    // Exclude staff role accounts from all user counts and completion stats
    const { data: staffRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "contributor", "tester", "facilityUser"]);
    const facilityUserAccountIds = new Set<string>(
      (staffRoles ?? []).filter((r: any) => r.role === "facilityUser").map((r: any) => r.user_id as string)
    );
    const staffUserIds = new Set<string>(
      (staffRoles ?? []).map((r: any) => r.user_id as string)
    );
    // Testers may have the facilityUser role for admin access, but when their
    // is_synthetic flag is false (analytics tracking on), their engagement should
    // count in the facility report just like a regular user's would.
    const testerIds = new Set<string>(
      (staffRoles ?? []).filter((r: any) => r.role === "tester").map((r: any) => r.user_id as string)
    );

    let userIdFilter: string[] | null = null;
    let facilityUserCount = 0;
    if (facilityValue) {
      const { data: profs, error } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("facility", facilityValue)
        .eq("is_synthetic", false);
      if (error) throw new Error(error.message);
      userIdFilter = (profs ?? [])
        .map((p: any) => p.user_id as string)
        // Exclude facilityUser accounts (facility staff), but not testers — testers
        // bypass this exclusion when is_synthetic=false so they can QA facility reports.
        .filter((id) => !facilityUserAccountIds.has(id) || testerIds.has(id));
      facilityUserCount = userIdFilter.length;
    }

    const [catsRes, itemsRes, totalUsersRes, catFacRes, itemFacRes, ratingsRes, bookmarksRes] = await Promise.all([
      supabaseAdmin
        .from("categories")
        .select("id, name, slug, icon_name, icon_color, sort_order, published, created_at")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("content_items")
        .select("id, category_id, title, type, duration, description, url, file_url, published, sort_order, created_at, exempt_from_progress")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("user_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("is_synthetic", false)
        .not("user_id", "in", `(${[...facilityUserAccountIds, "00000000-0000-0000-0000-000000000000"].join(",")})`),
      (supabaseAdmin as any).from("category_facilities").select("category_id, facility_value"),
      (supabaseAdmin as any).from("content_item_facilities").select("content_item_id, facility_value"),
      // Ratings: scope to facility users when a facility is selected (same as every
      // other metric); use global pre-computed totals only for the overall view.
      userIdFilter !== null
        ? userIdFilter.length > 0
          ? (supabaseAdmin as any).from("user_content_ratings").select("content_item_id, rating").in("user_id", userIdFilter)
          : Promise.resolve({ data: [] as any[] })
        : (supabaseAdmin as any).from("content_item_rating_totals").select("content_item_id, thumbs_up, thumbs_down").range(0, 4999),
      // Bookmarks: same scoping logic
      userIdFilter !== null
        ? userIdFilter.length > 0
          ? (supabaseAdmin as any).from("user_content_bookmarks").select("content_item_id").in("user_id", userIdFilter)
          : Promise.resolve({ data: [] as any[] })
        : (supabaseAdmin as any).from("content_item_bookmark_totals").select("content_item_id, bookmark_count").range(0, 4999),
    ]);
    if (catsRes.error) throw new Error(catsRes.error.message);
    if (itemsRes.error) throw new Error(itemsRes.error.message);

    // Build facility maps for category/item filtering
    const catFacMap: Record<string, string[]> = {};
    for (const r of (catFacRes.data ?? []) as { category_id: string; facility_value: string }[]) {
      if (!catFacMap[r.category_id]) catFacMap[r.category_id] = [];
      catFacMap[r.category_id].push(r.facility_value);
    }
    const itemFacMap: Record<string, string[]> = {};
    for (const r of (itemFacRes.data ?? []) as { content_item_id: string; facility_value: string }[]) {
      if (!itemFacMap[r.content_item_id]) itemFacMap[r.content_item_id] = [];
      itemFacMap[r.content_item_id].push(r.facility_value);
    }

    const filteredCategories = facilityValue
      ? (catsRes.data ?? []).filter((c: any) => {
          const f = catFacMap[c.id] ?? [];
          return f.length === 0 || f.includes(facilityValue);
        })
      : (catsRes.data ?? []);
    const filteredItems = (facilityValue
      ? (itemsRes.data ?? []).filter((i: any) => {
          const f = itemFacMap[i.id] ?? [];
          return f.length === 0 || f.includes(facilityValue);
        })
      : (itemsRes.data ?? [])
    ).filter((i: any) => !i.exempt_from_progress);
    const totalUsers = totalUsersRes.count ?? 0;

    // Early exit for facility reports with no users
    if (facilityValue && facilityUserCount === 0) {
      return {
        categories: filteredCategories,
        items: filteredItems,
        catViews: {}, catClicks: {}, itemClicks: {},
        totalViews: 0, totalClicks: 0,
        facilityUserCount, totalUsers, hoursSpent: 0,
        itemStats: {}, catCompletionRate: {}, overallCompletionRate: null,
      };
    }

    // Pre-fetch exempt item IDs so fetchAllProgress can exclude them via NOT IN.
    // Avoids PostgREST embedded-resource filter syntax which fails in paginated queries.
    const { data: exemptItemsData } = await (supabaseAdmin as any)
      .from("content_items")
      .select("id")
      .eq("exempt_from_progress", true);
    const exemptItemIds: string[] = (exemptItemsData ?? []).map((r: any) => r.id as string);

    const exclusionCtx: ExclusionContext = { staffUserIds, syntheticIds };

    const [dailyCountsRes, openersData, timeData, progressRows] = await Promise.all([
      fetchDailyCounts(sinceIso, facilityValue),
      fetchOpenersData(userIdFilter, sinceIso, exclusionCtx),
      fetchTimeData(userIdFilter, sinceIso, exclusionCtx),
      fetchAllProgress(userIdFilter, sinceIso, exclusionCtx, exemptItemIds),
    ]);
    if (dailyCountsRes.error) throw new Error(dailyCountsRes.error.message);

    // Aggregate pre-bucketed counts (fast — one row per day per category/content)
    const catViews: Record<string, number> = {};
    const catClicks: Record<string, number> = {};
    const itemClicks: Record<string, number> = {};
    let totalViews = 0;
    let totalClicks = 0;
    for (const row of (dailyCountsRes.data ?? []) as any[]) {
      const n = row.count as number;
      if (row.event_type === "category_view") {
        if (row.category_id) catViews[row.category_id] = (catViews[row.category_id] ?? 0) + n;
        totalViews += n;
      } else if (row.event_type === "content_click") {
        if (row.category_id) catClicks[row.category_id] = (catClicks[row.category_id] ?? 0) + n;
        if (row.content_id) itemClicks[row.content_id] = (itemClicks[row.content_id] ?? 0) + n;
        totalClicks += n;
      }
    }

    // Build unique opener counts per item
    const itemOpenerCounts: Record<string, number> = {};
    if (openersData.precomputed) {
      for (const row of openersData.rows as any[]) {
        itemOpenerCounts[row.content_item_id as string] = row.opener_count as number;
      }
    } else {
      const tempSets: Record<string, Set<string>> = {};
      for (const row of openersData.rows as any[]) {
        if (row.content_id && row.user_id) {
          if (!tempSets[row.content_id]) tempSets[row.content_id] = new Set();
          tempSets[row.content_id].add(row.user_id as string);
        }
      }
      for (const [id, s] of Object.entries(tempSets)) itemOpenerCounts[id] = s.size;
    }

    // Aggregate time data — shape differs by source
    const itemTotalSeconds: Record<string, number> = {};
    const itemEngagerCount: Record<string, number> = {};
    let totalSeconds = 0;
    if (timeData.precomputed) {
      // content_item_time_totals: one row per item with pre-summed totals
      for (const r of timeData.rows as any[]) {
        const id = r.content_item_id as string;
        const secs = (r.total_session_seconds as number) || 0;
        itemTotalSeconds[id] = secs;
        itemEngagerCount[id] = (r.engager_count as number) || 0;
        totalSeconds += secs;
      }
    } else {
      // user_content_engagement: one row per user per item, need to sum
      for (const r of timeData.rows as any[]) {
        const secs = (r.session_seconds as number) || 0;
        totalSeconds += secs;
        if (r.content_item_id && secs > 0) {
          const id = r.content_item_id as string;
          itemTotalSeconds[id] = (itemTotalSeconds[id] ?? 0) + secs;
          itemEngagerCount[id] = (itemEngagerCount[id] ?? 0) + 1;
        }
      }
    }
    const hoursSpent = Math.round((totalSeconds / 3600) * 10) / 10;

    const visibleItemIds = new Set(filteredItems.map((i: any) => i.id as string));

    // Completions from paginated progress rows
    const itemCompleters: Record<string, Set<string>> = {};
    for (const r of progressRows as any[]) {
      const id = r.content_item_id as string;
      if (!visibleItemIds.has(id)) continue;
      if (!itemCompleters[id]) itemCompleters[id] = new Set();
      itemCompleters[id].add(r.user_id as string);
    }

    // Build per-item stats. Completion rate only shown when click-event open data exists.
    const itemStats: Record<string, { openCount: number; completeCount: number; completionRate: number | null; avgSessionSeconds: number | null }> = {};
    let aggOpens = 0;
    let aggCompletes = 0;
    for (const itemId of visibleItemIds) {
      const trackedOpens = itemOpenerCounts[itemId] ?? 0;
      const completes = itemCompleters[itemId]?.size ?? 0;
      const openCount = Math.max(trackedOpens, completes);
      const completionRate = trackedOpens > 0 ? Math.round(completes / openCount * 100) : null;
      const avgSessionSeconds = itemTotalSeconds[itemId] && itemEngagerCount[itemId]
        ? Math.round(itemTotalSeconds[itemId] / itemEngagerCount[itemId])
        : null;
      itemStats[itemId] = { openCount, completeCount: completes, completionRate, avgSessionSeconds };
      if (trackedOpens > 0) {
        aggOpens += openCount;
        aggCompletes += completes;
      }
    }
    const overallCompletionRate = aggOpens > 0 ? Math.round(aggCompletes / aggOpens * 100) : null;

    // Build lookup maps for per-category and per-type aggregation
    const itemCatMap = new Map<string, string>();
    const itemTypeMap = new Map<string, string>();
    const catItemMap: Record<string, string[]> = {};
    for (const it of filteredItems as any[]) {
      itemCatMap.set(it.id as string, it.category_id as string);
      itemTypeMap.set(it.id as string, ((it.type as string) ?? 'other').toLowerCase());
      if (!catItemMap[it.category_id]) catItemMap[it.category_id] = [];
      catItemMap[it.category_id].push(it.id as string);
    }

    // Per-category completion rates, time, and depth
    const catCompletionRate: Record<string, number | null> = {};
    const catTotalSeconds: Record<string, number> = {};

    // Category depth: average items completed per user in each category
    const catUserCompletions: Record<string, Record<string, number>> = {};
    for (const r of progressRows as any[]) {
      const id = r.content_item_id as string;
      if (!visibleItemIds.has(id)) continue;
      const catId = itemCatMap.get(id);
      if (!catId) continue;
      if (!catUserCompletions[catId]) catUserCompletions[catId] = {};
      catUserCompletions[catId][r.user_id as string] = (catUserCompletions[catId][r.user_id as string] ?? 0) + 1;
    }
    const catDepth: Record<string, number | null> = {};
    for (const cat of filteredCategories as any[]) {
      let opens = 0, completes = 0, catSecs = 0;
      for (const itemId of catItemMap[cat.id] ?? []) {
        const s = itemStats[itemId];
        if (s && s.completionRate !== null) { opens += s.openCount; completes += s.completeCount; }
        catSecs += itemTotalSeconds[itemId] ?? 0;
      }
      catCompletionRate[cat.id] = opens > 0 ? Math.round(completes / opens * 100) : null;
      catTotalSeconds[cat.id] = catSecs;

      const userMap = catUserCompletions[cat.id];
      if (!userMap || Object.keys(userMap).length === 0) {
        catDepth[cat.id] = null;
      } else {
        const counts = Object.values(userMap);
        catDepth[cat.id] = Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10;
      }
    }

    // Content type preference stats
    const typeStatsRaw: Record<string, { itemCount: number; opens: number; completions: number; totalSeconds: number }> = {};
    for (const itemId of visibleItemIds) {
      const type = itemTypeMap.get(itemId) ?? 'other';
      if (!typeStatsRaw[type]) typeStatsRaw[type] = { itemCount: 0, opens: 0, completions: 0, totalSeconds: 0 };
      typeStatsRaw[type].itemCount += 1;
      const s = itemStats[itemId];
      if (s) { typeStatsRaw[type].opens += s.openCount; typeStatsRaw[type].completions += s.completeCount; }
      typeStatsRaw[type].totalSeconds += itemTotalSeconds[itemId] ?? 0;
    }
    const typeStats: Record<string, { itemCount: number; opens: number; completions: number; completionRate: number | null; totalSeconds: number }> = {};
    for (const [type, t] of Object.entries(typeStatsRaw)) {
      typeStats[type] = { ...t, completionRate: t.opens > 0 ? Math.round(t.completions / t.opens * 100) : null };
    }

    // Aggregate ratings — shape differs: raw rows (facility) vs pre-aggregated (overall)
    const itemRatings: Record<string, { thumbs_up: number; thumbs_down: number }> = {};
    if (userIdFilter !== null) {
      for (const r of (ratingsRes.data ?? []) as any[]) {
        const e = itemRatings[r.content_item_id] ?? { thumbs_up: 0, thumbs_down: 0 };
        if ((r.rating as number) === 1) e.thumbs_up++;
        else if ((r.rating as number) === -1) e.thumbs_down++;
        itemRatings[r.content_item_id] = e;
      }
    } else {
      for (const r of (ratingsRes.data ?? []) as any[]) {
        itemRatings[r.content_item_id as string] = { thumbs_up: r.thumbs_up as number, thumbs_down: r.thumbs_down as number };
      }
    }

    // Aggregate bookmarks — same shape split
    const itemBookmarks: Record<string, number> = {};
    if (userIdFilter !== null) {
      for (const r of (bookmarksRes.data ?? []) as any[]) {
        itemBookmarks[r.content_item_id] = (itemBookmarks[r.content_item_id] ?? 0) + 1;
      }
    } else {
      for (const r of (bookmarksRes.data ?? []) as any[]) {
        itemBookmarks[r.content_item_id as string] = r.bookmark_count as number;
      }
    }

    return {
      categories: filteredCategories,
      items: filteredItems,
      catViews, catClicks, itemClicks,
      totalViews, totalClicks,
      facilityUserCount, totalUsers, hoursSpent, totalSeconds,
      itemStats, catCompletionRate, catTotalSeconds, catDepth, typeStats, overallCompletionRate,
      itemRatings, itemBookmarks,
    };
  });


/**
 * List users belonging to a facility, with names/email/username.
 */
export const listFacilityUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        facilityValue: z.string().min(0).max(64).nullable().optional(),
        includeSynthetic: z.boolean().optional(),
        /** 0-indexed page number. Default 0. */
        page: z.number().int().min(0).optional(),
        /** Rows per page. 0 = return all (for CSV export). Default 10. */
        pageSize: z.number().int().min(0).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAnalyticsAdmin(context.userId);

    // facilityUser callers are scoped to their own facility only
    const { scoped, facility: callerFacility } = await isFacilityScoped(context.userId);
    if (scoped) {
      if (!callerFacility) throw new Error("Forbidden: no facility assigned");
      if (data.facilityValue && data.facilityValue !== callerFacility)
        throw new Error("Forbidden: user is not in your facility");
      data = { ...data, facilityValue: callerFacility };
    }

    const facilityValue = data.facilityValue ?? "";
    const includeSynthetic = data.includeSynthetic ?? false;
    const pageNum = data.page ?? 0;
    const pageSize = data.pageSize ?? 10;

    // Get facilityUser IDs to exclude — do this first so we can exclude them from the count
    const { data: facilityUserRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "facilityUser");
    const facilityUserIdSet = new Set((facilityUserRoles ?? []).map((r: any) => r.user_id as string));
    const excludeIds = [...facilityUserIdSet, "00000000-0000-0000-0000-000000000000"];

    // Build base query filter helper
    const buildQ = (select: string, head = false) => {
      let q = (supabaseAdmin as any)
        .from("user_profiles")
        .select(select, head ? { count: "exact", head: true } : undefined)
        .order("created_at", { ascending: false });
      if (!includeSynthetic) q = q.eq("is_synthetic", false);
      if (facilityValue) q = q.eq("facility", facilityValue);
      if (excludeIds.length > 0) q = q.not("user_id", "in", `(${excludeIds.join(",")})`);
      return q;
    };

    // Get total count efficiently without fetching rows
    const { count: totalCount } = await buildQ("user_id", true);
    const total = totalCount ?? 0;

    // Fetch only the requested page
    let profilesQ = buildQ("user_id, username, first_name, last_name, facility, created_at");
    if (pageSize > 0) {
      profilesQ = profilesQ.range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);
    }
    const { data: profileRows, error: profileErr } = await profilesQ;
    if (profileErr) throw new Error(profileErr.message);
    const profs = profileRows ?? [];
    const ids = profs.map((p: any) => p.user_id as string);


    // Fetch most recent login date per user from user_logins (more accurate than auth last_sign_in_at)
    const lastLoginById = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: loginRows, error: le } = await supabaseAdmin
        .from("user_logins")
        .select("user_id, login_date")
        .in("user_id", ids);
      if (le) throw new Error(le.message);
      for (const r of loginRows ?? []) {
        const prev = lastLoginById.get(r.user_id as string);
        const d = r.login_date as string;
        if (!prev || d > prev) lastLoginById.set(r.user_id as string, d);
      }
    }

    // Fetch facility labels so we can show names instead of slugs
    const { data: facilitiesData } = await supabaseAdmin
      .from("facilities")
      .select("value, label");
    const facilityLabelMap = new Map<string, string>(
      (facilitiesData ?? []).map((f: any) => [f.value as string, f.label as string])
    );

    // Fetch engagement tiers from pre-computed user_stats
    const tierById = new Map<string, { tier: string | null; percentile: number | null }>();
    if (ids.length > 0) {
      const { data: statsRows } = await (supabaseAdmin as any)
        .from("user_stats")
        .select("user_id, facility_percentile")
        .in("user_id", ids);
      for (const r of (statsRows ?? []) as any[]) {
        const pctVal: number | null = r.facility_percentile ?? null;
        const tierVal = pctVal === null ? null
          : pctVal >= 80 ? "Top Reader"
          : pctVal >= 50 ? "Active Reader"
          : pctVal >= 20 ? "Getting Started"
          : "Just Joined";
        tierById.set(r.user_id as string, { tier: tierVal, percentile: pctVal });
      }
    }

    return {
      total,
      users: profs.map((p: any) => ({
        user_id: p.user_id as string,
        username: (p.username as string) ?? "",
        first_name: (p.first_name as string) ?? "",
        last_name: (p.last_name as string) ?? "",
        facility: (p.facility as string) ?? "",
        facility_label: facilityLabelMap.get(p.facility as string) ?? (p.facility as string) ?? "",
        created_at: p.created_at as string,
        last_login_date: lastLoginById.get(p.user_id as string) ?? null,
        engagement_tier: tierById.get(p.user_id as string)?.tier ?? null,
        facility_percentile: tierById.get(p.user_id as string)?.percentile ?? null,
      })),
    };

  });

/**
 * Per-user progress report — items the user has read per category, plus
 * basic activity counts (logins, minutes spent, total events).
 */
export const getUserProgressReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAnalyticsAdmin(context.userId);

    // facilityUser callers may only view users within their own facility (admins see all)
    const { scoped, facility: callerFacility } = await isFacilityScoped(context.userId);
    if (scoped) {
      const { data: targetProf } = await supabaseAdmin.from("user_profiles").select("facility").eq("user_id", data.userId).maybeSingle();
      if (!callerFacility || callerFacility !== targetProf?.facility) {
        throw new Error("Forbidden: user is not in your facility");
      }
    }

    const [profRes, catsRes, itemsRes, progRes, loginsRes, catViewsRes, contentClicksRes, catFacRes, itemFacRes, engRes, statsRes, userBookmarksRes, userRatingsRes, userAchievementsRes] = await Promise.all([
      supabaseAdmin
        .from("user_profiles")
        .select("user_id, username, first_name, last_name, facility, created_at")
        .eq("user_id", data.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("categories")
        .select("id, name, slug, icon_name, icon_color, sort_order, published")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("content_items")
        .select("id, category_id, title, description, type, duration, url, file_url, sort_order, published, exempt_from_progress")
        .eq("published", true)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("user_content_progress")
        .select("content_item_id, category_id, created_at")
        .eq("user_id", data.userId),
      supabaseAdmin
        .from("user_logins")
        .select("login_date")
        .eq("user_id", data.userId),
      supabaseAdmin
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", data.userId)
        .eq("event_type", "category_view"),
      supabaseAdmin
        .from("analytics_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", data.userId)
        .eq("event_type", "content_click"),
      (supabaseAdmin as any).from("category_facilities").select("category_id, facility_value"),
      (supabaseAdmin as any).from("content_item_facilities").select("content_item_id, facility_value"),
      (supabaseAdmin as any)
        .from("user_content_engagement")
        .select("content_item_id, session_seconds, media_progress_seconds, media_duration_seconds, manual_completion_pct")
        .eq("user_id", data.userId),
      (supabaseAdmin as any)
        .from("user_stats")
        .select("facility_percentile, items_completed, items_started, total_session_seconds, updated_at")
        .eq("user_id", data.userId)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("user_content_bookmarks")
        .select("content_item_id")
        .eq("user_id", data.userId),
      (supabaseAdmin as any)
        .from("user_content_ratings")
        .select("content_item_id, rating")
        .eq("user_id", data.userId),
      (supabaseAdmin as any)
        .from("user_achievements")
        .select("achievement_key, earned_at")
        .eq("user_id", data.userId),
    ]);
    if (profRes.error) throw new Error(profRes.error.message);
    if (catsRes.error) throw new Error(catsRes.error.message);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (progRes.error) throw new Error(progRes.error.message);
    if (loginsRes.error) throw new Error(loginsRes.error.message);
    if (catViewsRes.error) throw new Error(catViewsRes.error.message);
    if (contentClicksRes.error) throw new Error(contentClicksRes.error.message);

    const userBookmarkSet = new Set<string>((userBookmarksRes.data ?? []).map((r: any) => r.content_item_id as string));
    const userRatingMap = new Map<string, 1 | -1>((userRatingsRes.data ?? []).map((r: any) => [r.content_item_id as string, r.rating as 1 | -1]));
    const userAchievements: Record<string, string> = {};
    for (const r of (userAchievementsRes.data ?? []) as any[]) {
      userAchievements[r.achievement_key as string] = r.earned_at as string;
    }

    const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = userInfo?.user?.email ?? "";

    // Filter categories and items to what this user's facility can see
    const userFacility: string | null = (profRes.data as any)?.facility ?? null;
    const catFacMap: Record<string, string[]> = {};
    for (const r of (catFacRes.data ?? []) as { category_id: string; facility_value: string }[]) {
      if (!catFacMap[r.category_id]) catFacMap[r.category_id] = [];
      catFacMap[r.category_id].push(r.facility_value);
    }
    const itemFacMap: Record<string, string[]> = {};
    for (const r of (itemFacRes.data ?? []) as { content_item_id: string; facility_value: string }[]) {
      if (!itemFacMap[r.content_item_id]) itemFacMap[r.content_item_id] = [];
      itemFacMap[r.content_item_id].push(r.facility_value);
    }
    const visibleCats = (catsRes.data ?? []).filter((c: any) => {
      const f = catFacMap[c.id] ?? [];
      if (f.length === 0) return true;
      if (!userFacility) return false;
      return f.includes(userFacility);
    });
    const visibleItems = (itemsRes.data ?? []).filter((i: any) => {
      const f = itemFacMap[i.id] ?? [];
      if (f.length === 0) return true;
      if (!userFacility) return false;
      return f.includes(userFacility);
    });

    const readSet = new Set<string>(
      (progRes.data ?? []).map((r: any) => r.content_item_id as string),
    );

    // Build read-date map: contentItemId → ISO date string of when item was marked read
    const readAtByItem = new Map<string, string>();
    for (const r of (progRes.data ?? []) as any[]) {
      if (r.created_at) readAtByItem.set(r.content_item_id as string, r.created_at as string);
    }

    // Build engagement map: contentItemId → { sessionSeconds, mediaProgressSeconds, mediaDurationSeconds, manualCompletionPct }
    const engagementByItem = new Map<string, { sessionSeconds: number; mediaProgressSeconds: number | null; mediaDurationSeconds: number | null; manualCompletionPct: number | null }>();
    for (const r of (engRes?.data ?? []) as any[]) {
      engagementByItem.set(r.content_item_id as string, {
        sessionSeconds: (r.session_seconds as number) || 0,
        mediaProgressSeconds: r.media_progress_seconds as number | null,
        mediaDurationSeconds: r.media_duration_seconds as number | null,
        manualCompletionPct: r.manual_completion_pct as number | null,
      });
    }
    const totalSessionSeconds = Array.from(engagementByItem.values()).reduce((s, e) => s + e.sessionSeconds, 0);

    // Engagement tier from pre-computed user_stats
    const userStatsRow = statsRes?.data as any;
    const facilityPercentile: number | null = userStatsRow?.facility_percentile ?? null;
    const engagementTier = facilityPercentile === null ? null
      : facilityPercentile >= 80 ? "Top Reader"
      : facilityPercentile >= 50 ? "Active Reader"
      : facilityPercentile >= 20 ? "Getting Started"
      : "Just Joined";
    const statsUpdatedAt: string | null = userStatsRow?.updated_at ?? null;
    const hoursSpent = Math.round((totalSessionSeconds / 3600) * 10) / 10;

    return {
      profile: profRes.data
        ? {
            user_id: (profRes.data as any).user_id,
            username: (profRes.data as any).username ?? "",
            first_name: (profRes.data as any).first_name ?? "",
            last_name: (profRes.data as any).last_name ?? "",
            facility: (profRes.data as any).facility ?? "",
            email,
            created_at: (profRes.data as any).created_at,
          }
        : null,
      categories: visibleCats.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon_name: c.icon_name,
        icon_color: c.icon_color,
        published: c.published,
      })),
      items: visibleItems.map((i: any) => {
        const eng = engagementByItem.get(i.id as string);
        const mediaPct = eng?.mediaProgressSeconds && eng?.mediaDurationSeconds && eng.mediaDurationSeconds > 0
          ? Math.min(100, Math.round((eng.mediaProgressSeconds / eng.mediaDurationSeconds) * 100))
          : null;
        const isPdfItem = ((i.file_url && /\.pdf(\?|#|$)/i.test(i.file_url as string)) || (i.url && /\.pdf(\?|#|$)/i.test(i.url as string)));
        const pdfEstSec = isPdfItem ? parseMinutes(i.duration) * 60 : 0;
        const sessionSecs = eng?.sessionSeconds ?? 0;
        const pdfProgressPct = !readSet.has(i.id) && isPdfItem && pdfEstSec > 0 && sessionSecs > 0
          ? Math.min(100, Math.round((sessionSecs / (pdfEstSec * 0.95)) * 100))
          : null;
        return {
          id: i.id,
          category_id: i.category_id,
          title: i.title,
          description: i.description ?? "",
          type: i.type,
          duration: i.duration,
          url: i.url ?? null,
          file_url: i.file_url ?? null,
          read: readSet.has(i.id),
          read_at: readAtByItem.get(i.id as string) ?? null,
          sessionSeconds: sessionSecs,
          mediaProgressPct: mediaPct,
          pdfProgressPct,
          manualCompletionPct: eng?.manualCompletionPct ?? null,
          bookmarked: userBookmarkSet.has(i.id as string),
          rating: userRatingMap.get(i.id as string) ?? null,
          exempt_from_progress: (i.exempt_from_progress as boolean) ?? false,
        };
      }),
      progress: (progRes.data ?? []).map((r: any) => ({
        content_item_id: r.content_item_id,
        category_id: r.category_id,
        created_at: r.created_at,
      })),
      logins: (loginsRes.data ?? []).map((r: any) => r.login_date as string),
      hoursSpent,
      totalSeconds: totalSessionSeconds,
      engagementTier,
      facilityPercentile,
      statsUpdatedAt,
      eventCounts: {
        categoryViews: catViewsRes.count ?? 0,
        contentClicks: contentClicksRes.count ?? 0,
      },
      achievements: userAchievements,
    };
  });

/**
 * Bulk facility progress export — all users × all items for a specific facility.
 * Returns raw data for client-side CSV generation (one row per user+item).
 * Requires a specific facilityValue — "all facilities" is not supported for
 * performance reasons. FacilityUsers are scoped to their own facility.
 */
export const getBulkFacilityProgressReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ facilityValue: z.string().min(1) }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAnalyticsAdmin(context.userId);

    // Enforce facility scope for facilityUser callers (admins see all)
    let facilityValue = data.facilityValue;
    const { scoped, facility: callerFacility } = await isFacilityScoped(context.userId);
    if (scoped) {
      if (!callerFacility) throw new Error("Forbidden: no facility assigned");
      if (facilityValue !== callerFacility) throw new Error("Forbidden: user is not in your facility");
    }

    // Staff IDs to exclude from the user list
    const { data: staffRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "contributor", "tester", "facilityUser"]);
    const staffIds = new Set<string>((staffRoles ?? []).map((r: any) => r.user_id as string));

    // All regular users at this facility
    const { data: profiles } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id, username, first_name, last_name")
      .eq("facility", facilityValue)
      .eq("is_synthetic", false)
      .order("last_name", { ascending: true });
    const facilityUsers = (profiles ?? []).filter((u: any) => !staffIds.has(u.user_id as string));
    const userIds = facilityUsers.map((u: any) => u.user_id as string);

    if (userIds.length === 0) {
      return { users: [], categories: [], items: [], progress: [], engagement: [], bookmarks: [], ratings: [], logins: [], userStats: [] };
    }

    // Facility-visible categories and items
    const [catFacRes, itemFacRes, catsRes] = await Promise.all([
      (supabaseAdmin as any).from("category_facilities").select("category_id, facility_value").range(0, 4999),
      (supabaseAdmin as any).from("content_item_facilities").select("content_item_id, facility_value").range(0, 4999),
      supabaseAdmin.from("categories").select("id, name, slug, sort_order").eq("published", true).order("sort_order"),
    ]);
    const catFacMap: Record<string, string[]> = {};
    for (const r of (catFacRes.data ?? []) as any[]) {
      if (!catFacMap[r.category_id]) catFacMap[r.category_id] = [];
      catFacMap[r.category_id].push(r.facility_value as string);
    }
    const itemFacMap: Record<string, string[]> = {};
    for (const r of (itemFacRes.data ?? []) as any[]) {
      if (!itemFacMap[r.content_item_id]) itemFacMap[r.content_item_id] = [];
      itemFacMap[r.content_item_id].push(r.facility_value as string);
    }
    const visibleCats = (catsRes.data ?? []).filter((c: any) => {
      const f = catFacMap[c.id] ?? [];
      return f.length === 0 || f.includes(facilityValue);
    });
    const visibleCatIds = visibleCats.map((c: any) => c.id as string);

    const itemsRes = await supabaseAdmin
      .from("content_items")
      .select("id, category_id, title, type, duration, url, file_url, exempt_from_progress, sort_order")
      .eq("published", true)
      .in("category_id", visibleCatIds)
      .order("sort_order");
    const visibleItems = (itemsRes.data ?? []).filter((i: any) => {
      const f = itemFacMap[i.id] ?? [];
      return f.length === 0 || f.includes(facilityValue);
    });

    // Fetch all per-user data in parallel, chunked to stay under URL limits
    const chunks = chunkIds(userIds);

    const fetchChunked = async (table: string, select: string): Promise<any[]> => {
      const all: any[] = [];
      const PAGE = 1000;
      for (const chunk of chunks) {
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await (supabaseAdmin as any)
            .from(table)
            .select(select)
            .in("user_id", chunk)
            .range(from, from + PAGE - 1);
          if (error || !data?.length) break;
          all.push(...data);
          if (data.length < PAGE) break;
        }
      }
      return all;
    };

    const [progress, engagement, bookmarks, ratings, logins, userStats] = await Promise.all([
      fetchChunked("user_content_progress", "user_id, content_item_id, created_at"),
      fetchChunked("user_content_engagement", "user_id, content_item_id, session_seconds, media_progress_seconds, media_duration_seconds, manual_completion_pct"),
      fetchChunked("user_content_bookmarks", "user_id, content_item_id"),
      fetchChunked("user_content_ratings", "user_id, content_item_id, rating"),
      (async () => {
        // Last login per user — fetch all logins then deduplicate to most recent
        const all: any[] = [];
        const PAGE = 1000;
        for (const chunk of chunks) {
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabaseAdmin
              .from("user_logins")
              .select("user_id, login_date")
              .in("user_id", chunk)
              .order("login_date", { ascending: false })
              .range(from, from + PAGE - 1);
            if (error || !data?.length) break;
            all.push(...data);
            if (data.length < PAGE) break;
          }
        }
        return all;
      })(),
      fetchChunked("user_stats", "user_id, items_completed, total_session_seconds, facility_percentile"),
    ]);

    return {
      users: facilityUsers,
      categories: visibleCats,
      items: visibleItems,
      progress,
      engagement,
      bookmarks,
      ratings,
      logins,
      userStats,
    };
  });
