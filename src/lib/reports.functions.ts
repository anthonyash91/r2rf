import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

    let userIdFilter: string[] | null = null;
    let facilityUserCount = 0;
    if (facilityValue) {
      const { data: profs, error } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("facility", facilityValue)
        .eq("is_synthetic", false);
      if (error) throw new Error(error.message);
      userIdFilter = (profs ?? []).map((p: any) => p.user_id as string);
      facilityUserCount = userIdFilter.length;
    }

    const [catsRes, itemsRes, totalUsersRes, catFacRes, itemFacRes] = await Promise.all([
      supabaseAdmin.from("categories").select("*").order("sort_order", { ascending: true }),
      supabaseAdmin.from("content_items").select("*").order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("user_profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("is_synthetic", false),
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
      };
    }

    // Query pre-aggregated counts — no row limit, no raw event scanning
    let countsQ = (supabaseAdmin as any)
      .from("analytics_daily_counts")
      .select("event_type, category_id, content_id, count");
    if (sinceIso) countsQ = countsQ.gte("period_date", sinceIso.slice(0, 10));
    if (facilityValue) {
      countsQ = countsQ.eq("facility_value", facilityValue);
    }

    // Hours spent: still derived from user_content_progress + item durations
    const minutesByItem = new Map<string, number>();
    for (const it of (itemsRes.data ?? []) as any[]) {
      minutesByItem.set(it.id, parseDurationMinutes(it.duration));
    }
    let pq = supabaseAdmin
      .from("user_content_progress")
      .select("content_item_id, user_id");
    if (sinceIso) pq = pq.gte("created_at", sinceIso);
    if (userIdFilter !== null) {
      if (userIdFilter.length === 0) {
        // No users in this facility — skip the progress query
        pq = pq.eq("user_id", "00000000-0000-0000-0000-000000000000");
      } else {
        pq = pq.in("user_id", userIdFilter);
      }
    } else if (syntheticIds.size > 0) {
      pq = pq.not("user_id", "in", `(${Array.from(syntheticIds).join(",")})`);
    }

    const [countsRes, progRes] = await Promise.all([countsQ, pq]);
    if (countsRes.error) throw new Error(countsRes.error.message);
    if (progRes.error) throw new Error(progRes.error.message);

    // Aggregate the pre-bucketed counts
    const catViews: Record<string, number> = {};
    const catClicks: Record<string, number> = {};
    const itemClicks: Record<string, number> = {};
    let totalViews = 0;
    let totalClicks = 0;
    for (const row of (countsRes.data ?? []) as any[]) {
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

    let totalMinutes = 0;
    for (const p of progRes.data ?? []) {
      totalMinutes += minutesByItem.get((p as any).content_item_id as string) ?? 0;
    }
    const hoursSpent = Math.round((totalMinutes / 60) * 10) / 10;

    return {
      categories: filteredCategories,
      items: filteredItems,
      catViews, catClicks, itemClicks,
      totalViews, totalClicks,
      facilityUserCount, totalUsers, hoursSpent,
    };
  });

function parseDurationMinutes(d?: string | null): number {
  if (!d) return 0;
  let total = 0;
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const n = parseFloat(m[1]);
    const u = (m[2] ?? "min").toLowerCase();
    total += u.startsWith("h") ? n * 60 : n;
  }
  return total;
}

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
        .select("user_id, username, first_name, last_name, facility, created_at")
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

    return {
      users: profs.map((p: any) => ({
        user_id: p.user_id as string,
        username: (p.username as string) ?? "",
        first_name: (p.first_name as string) ?? "",
        last_name: (p.last_name as string) ?? "",
        facility: (p.facility as string) ?? "",
        email: emailById.get(p.user_id as string) ?? "",
        created_at: p.created_at as string,
        last_sign_in_at: lastSignInById.get(p.user_id as string) ?? null,
        last_login_date: lastLoginById.get(p.user_id as string) ?? null,
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

    const [profRes, catsRes, itemsRes, progRes, loginsRes, eventsRes, catFacRes, itemFacRes] = await Promise.all([
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
      items: visibleItems.map((i: any) => ({
        id: i.id,
        category_id: i.category_id,
        title: i.title,
        description: i.description ?? "",
        type: i.type,
        duration: i.duration,
        url: i.url ?? null,
        file_url: i.file_url ?? null,
        read: readSet.has(i.id),
      })),
      progress: (progRes.data ?? []).map((r: any) => ({
        content_item_id: r.content_item_id,
        category_id: r.category_id,
        created_at: r.created_at,
      })),
      logins: (loginsRes.data ?? []).map((r: any) => r.login_date as string),
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
