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
    await assertAdmin(context.supabase, context.userId);
    const sinceIso = sinceIsoFor(data.range);
    const facilityValue = data.facilityValue ?? null;

    let userIdFilter: string[] | null = null;
    let facilityUserCount = 0;
    if (facilityValue) {
      const { data: profs, error } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id")
        .eq("facility", facilityValue);
      if (error) throw new Error(error.message);
      userIdFilter = (profs ?? []).map((p: any) => p.user_id as string);
      facilityUserCount = userIdFilter.length;
    }

    const [catsRes, itemsRes] = await Promise.all([
      supabaseAdmin.from("categories").select("*").order("sort_order", { ascending: true }),
      supabaseAdmin.from("content_items").select("*").order("sort_order", { ascending: true }),
    ]);
    if (catsRes.error) throw new Error(catsRes.error.message);
    if (itemsRes.error) throw new Error(itemsRes.error.message);

    let q = supabaseAdmin
      .from("analytics_events")
      .select("event_type, category_id, content_id, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(50000);
    if (sinceIso) q = q.gte("created_at", sinceIso);
    if (userIdFilter !== null) {
      if (userIdFilter.length === 0) {
        return {
          categories: catsRes.data ?? [],
          items: itemsRes.data ?? [],
          events: [],
        };
      }
      q = q.in("user_id", userIdFilter);
    }
    const evRes = await q;
    if (evRes.error) throw new Error(evRes.error.message);

    return {
      categories: catsRes.data ?? [],
      items: itemsRes.data ?? [],
      events: evRes.data ?? [],
    };
  });

/**
 * List users belonging to a facility, with names/email/username.
 */
export const listFacilityUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ facilityValue: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: profs, error } = await supabaseAdmin
      .from("user_profiles")
      .select("user_id, username, first_name, last_name, facility, created_at")
      .eq("facility", data.facilityValue);
    if (error) throw new Error(error.message);
    const ids = (profs ?? []).map((p: any) => p.user_id as string);

    const emailById = new Map<string, string>();
    if (ids.length > 0) {
      // listUsers paginates; 200 is enough for typical facility sizes
      const { data: usersData, error: ue } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (ue) throw new Error(ue.message);
      for (const u of usersData.users) {
        if (ids.includes(u.id)) emailById.set(u.id, u.email ?? "");
      }
    }

    return {
      users: (profs ?? []).map((p: any) => ({
        user_id: p.user_id as string,
        username: (p.username as string) ?? "",
        first_name: (p.first_name as string) ?? "",
        last_name: (p.last_name as string) ?? "",
        email: emailById.get(p.user_id as string) ?? "",
        created_at: p.created_at as string,
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
    await assertAdmin(context.supabase, context.userId);

    const [profRes, catsRes, itemsRes, progRes, loginsRes, eventsRes] = await Promise.all([
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
    ]);
    if (profRes.error) throw new Error(profRes.error.message);
    if (catsRes.error) throw new Error(catsRes.error.message);
    if (itemsRes.error) throw new Error(itemsRes.error.message);
    if (progRes.error) throw new Error(progRes.error.message);
    if (loginsRes.error) throw new Error(loginsRes.error.message);
    if (eventsRes.error) throw new Error(eventsRes.error.message);

    const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = userInfo?.user?.email ?? "";

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
      categories: (catsRes.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon_name: c.icon_name,
        icon_color: c.icon_color,
        published: c.published,
      })),
      items: (itemsRes.data ?? []).map((i: any) => ({
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
