import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { parseMinutes } from "@/lib/duration";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden: admin access required");
}

async function assertAnyAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "contributor", "facilityUser"])
    .maybeSingle();
  if (error || !data) throw new Error("Forbidden: admin access required");
}

const RangeSchema = z.enum(["7d", "30d", "90d", "all"]);

function sinceIsoFor(range: z.infer<typeof RangeSchema>): string | null {
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
    await assertAnyAdmin(context.userId);
    const sinceIso = sinceIsoFor(data.range);
    const facilityValue = data.facilityValue ?? null;

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
        .filter((id) => !facilityUserAccountIds.has(id));
      facilityUserCount = userIdFilter.length;
    }

    const [catsRes, itemsRes, totalUsersRes, catFacRes, itemFacRes] = await Promise.all([
      supabaseAdmin
        .from("categories")
        .select("id, name, slug, icon_name, icon_color, sort_order, published, created_at")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("content_items")
        .select("id, category_id, title, type, duration, description, url, file_url, published, sort_order, created_at")
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("user_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("is_synthetic", false)
        .not("user_id", "in", `(${[...facilityUserAccountIds, "00000000-0000-0000-0000-000000000000"].join(",")})`),
      (supabaseAdmin as any).from("category_facilities").select("category_id, facility_value"),
      (supabaseAdmin as any).from("content_item_facilities").select("content_item_id, facility_value"),
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
    const filteredItems = facilityValue
      ? (itemsRes.data ?? []).filter((i: any) => {
          const f = itemFacMap[i.id] ?? [];
          return f.length === 0 || f.includes(facilityValue);
        })
      : (itemsRes.data ?? []);
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

    // ── Query 1: analytics_daily_counts for visit/click totals (pre-aggregated, fast) ──
    // The trigger already excludes staff and synthetic users, so no user filter needed here.
    let dailyCountsQ = (supabaseAdmin as any)
      .from("analytics_daily_counts")
      .select("event_type, category_id, content_id, count");
    if (sinceIso) dailyCountsQ = dailyCountsQ.gte("period_date", sinceIso.slice(0, 10));
    if (facilityValue) dailyCountsQ = dailyCountsQ.eq("facility_value", facilityValue);

    // ── Query 2: analytics_events content_click only — for unique openers per item ──
    // Still needed for completion rate deduplication (daily_counts doesn't have user_id).
    // Narrower than before: only content_click events, only 2 columns.
    let openersQ = supabaseAdmin
      .from("analytics_events")
      .select("user_id, content_id")
      .eq("event_type", "content_click")
      .not("user_id", "is", null);
    if (sinceIso) openersQ = (openersQ as any).gte("created_at", sinceIso);
    if (userIdFilter !== null) {
      if (userIdFilter.length === 0) {
        openersQ = (openersQ as any).eq("user_id", "00000000-0000-0000-0000-000000000000");
      } else {
        openersQ = (openersQ as any).in("user_id", userIdFilter);
      }
    } else {
      const excludeAll = [
        ...Array.from(staffUserIds),
        ...Array.from(syntheticIds),
        "00000000-0000-0000-0000-000000000000",
      ];
      if (excludeAll.length > 0) {
        openersQ = (openersQ as any).not("user_id", "in", `(${excludeAll.join(",")})`);
      }
    }

    // ── Query 3: time data from user_content_sessions ────────────────────────
    // user_content_sessions has a recorded_at timestamp so time can be filtered
    // by date range. Each row = one session (INSERT on close, never upserted).
    //
    // Overall + all-time (no sinceIso): use content_item_time_totals — one row
    //   per item, O(items), always current via trigger. No date scan needed.
    // Everything else: paginate user_content_sessions with date + user filters.
    const fetchTimeData = async (): Promise<{ precomputed: boolean; rows: any[] }> => {
      // Fast path: all-time overall view — single indexed query
      if (userIdFilter === null && !sinceIso) {
        const { data } = await (supabaseAdmin as any)
          .from("content_item_time_totals")
          .select("content_item_id, total_session_seconds, engager_count");
        return { precomputed: true, rows: data ?? [] };
      }
      if (userIdFilter !== null && userIdFilter.length === 0) {
        return { precomputed: false, rows: [] };
      }
      // Date-filtered or facility-scoped: paginate user_content_sessions
      const PAGE = 1000;
      const all: any[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = (supabaseAdmin as any)
          .from("user_content_sessions")
          .select("user_id, content_item_id, session_seconds")
          .range(from, from + PAGE - 1);
        if (sinceIso) q = q.gte("recorded_at", sinceIso);
        if (userIdFilter !== null) {
          q = q.in("user_id", userIdFilter);
        } else {
          const excludeAll = [
            ...Array.from(staffUserIds),
            ...Array.from(syntheticIds),
            "00000000-0000-0000-0000-000000000000",
          ];
          if (excludeAll.length > 0) q = q.not("user_id", "in", `(${excludeAll.join(",")})`);
        }
        const { data, error } = await q;
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
      }
      return { precomputed: false, rows: all };
    };

    // ── Query 4: user_content_progress for completions (paginated) ──────────
    const fetchAllProgress = async () => {
      const PAGE = 1000;
      const all: any[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = (supabaseAdmin as any)
          .from("user_content_progress")
          .select("content_item_id, user_id")
          .range(from, from + PAGE - 1);
        if (sinceIso) q = q.gte("created_at", sinceIso);
        if (userIdFilter !== null) {
          if (userIdFilter.length === 0) {
            q = q.eq("user_id", "00000000-0000-0000-0000-000000000000");
          } else {
            q = q.in("user_id", userIdFilter);
          }
        } else {
          const excludeAll = [
            ...Array.from(staffUserIds),
            ...Array.from(syntheticIds),
            "00000000-0000-0000-0000-000000000000",
          ];
          if (excludeAll.length > 0) q = q.not("user_id", "in", `(${excludeAll.join(",")})`);
        }
        const { data, error } = await q;
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
      }
      return all;
    };

    const [dailyCountsRes, openersRes, timeData, progressRows] = await Promise.all([
      dailyCountsQ, openersQ, fetchTimeData(), fetchAllProgress(),
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

    // Build unique openers per item (for completion rate deduplication)
    const itemOpeners: Record<string, Set<string>> = {};
    for (const row of (openersRes?.data ?? []) as any[]) {
      if (row.content_id && row.user_id) {
        if (!itemOpeners[row.content_id]) itemOpeners[row.content_id] = new Set();
        itemOpeners[row.content_id].add(row.user_id as string);
      }
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
      const trackedOpens = itemOpeners[itemId]?.size ?? 0;
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

    return {
      categories: filteredCategories,
      items: filteredItems,
      catViews, catClicks, itemClicks,
      totalViews, totalClicks,
      facilityUserCount, totalUsers, hoursSpent, totalSeconds,
      itemStats, catCompletionRate, catTotalSeconds, catDepth, typeStats, overallCompletionRate,
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
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAnyAdmin(context.userId);

    const facilityValue = data.facilityValue ?? "";
    const includeSynthetic = data.includeSynthetic ?? false;

    // Paginate to fetch ALL profiles (Supabase enforces a per-request row cap).
    const PAGE_SIZE = 1000;
    const allProfs: any[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let pq = supabaseAdmin
        .from("user_profiles")
        .select("user_id, username, first_name, last_name, facility, created_at, inmate_pin")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (!includeSynthetic) pq = pq.eq("is_synthetic", false);
      if (facilityValue) pq = pq.eq("facility", facilityValue);
      const { data: page, error } = await pq;
      if (error) throw new Error(error.message);
      const rows = page ?? [];
      allProfs.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
    // Exclude facilityUser role accounts — reports should only show regular users
    const { data: facilityUserRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "facilityUser");
    const facilityUserIdSet = new Set((facilityUserRoles ?? []).map((r: any) => r.user_id as string));
    const profs = allProfs.filter((p: any) => !facilityUserIdSet.has(p.user_id));
    const ids = profs.map((p: any) => p.user_id as string);


    const emailById = new Map<string, string>();
    const lastSignInById = new Map<string, string | null>();
    if (ids.length > 0) {
      const idSet = new Set(ids);
      const AUTH_PAGE_SIZE = 1000;
      for (let page = 1; ; page += 1) {
        const { data: usersData, error: ue } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: AUTH_PAGE_SIZE,
        });
        if (ue) throw new Error(ue.message);
        const authUsers = usersData.users ?? [];
        for (const u of authUsers) {
          if (idSet.has(u.id)) {
            emailById.set(u.id, u.email ?? "");
            lastSignInById.set(u.id, (u as any).last_sign_in_at ?? null);
          }
        }
        if (authUsers.length < AUTH_PAGE_SIZE) break;
      }
    }

    // Also fetch most recent user_logins date for each user as a fallback / more accurate "last login"
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
      users: profs.map((p: any) => ({
        user_id: p.user_id as string,
        username: (p.username as string) ?? "",
        first_name: (p.first_name as string) ?? "",
        last_name: (p.last_name as string) ?? "",
        facility: (p.facility as string) ?? "",
        facility_label: facilityLabelMap.get(p.facility as string) ?? (p.facility as string) ?? "",
        inmate_pin: (p.inmate_pin as string) ?? null,
        email: emailById.get(p.user_id as string) ?? "",
        created_at: p.created_at as string,
        last_sign_in_at: lastSignInById.get(p.user_id as string) ?? null,
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
    await assertAnyAdmin(context.userId);

    const [profRes, catsRes, itemsRes, progRes, loginsRes, eventsRes, catFacRes, itemFacRes, engRes, statsRes] = await Promise.all([
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
        .select("id, category_id, title, description, type, duration, url, file_url, sort_order, published")
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
        .select("event_type, created_at")
        .eq("user_id", data.userId),
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
    ]);
    if (profRes.error) throw new Error(profRes.error.message);
    if (catsRes.error) throw new Error(catsRes.error.message);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (progRes.error) throw new Error(progRes.error.message);
    if (loginsRes.error) throw new Error(loginsRes.error.message);
    if (eventsRes.error) throw new Error(eventsRes.error.message);

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
        categoryViews: (eventsRes.data ?? []).filter(
          (e: any) => e.event_type === "category_view",
        ).length,
        contentClicks: (eventsRes.data ?? []).filter(
          (e: any) => e.event_type === "content_click",
        ).length,
      },
    };
  });
