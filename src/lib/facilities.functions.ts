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

export const listFacilities = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("facilities")
    .select("id, value, label, sort_order, site_id")
    .eq("hidden", false)
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return {
    facilities: (data ?? []).map((f) => ({
      id: f.id as string,
      value: f.value as string,
      label: f.label as string,
      sort_order: f.sort_order as number,
      siteId: (f.site_id ?? null) as string | null,
    })),
  };
});

export const listAllFacilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("facilities")
      .select("id, value, label, sort_order, site_id")
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      facilities: (data ?? []).map((f) => ({
        id: f.id as string,
        value: f.value as string,
        label: f.label as string,
        sort_order: f.sort_order as number,
        siteId: (f.site_id ?? null) as string | null,
      })),
    };
  });

export const listFacilitiesWithStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const [facRes, cifRes, catFacRes, msgRes, facilityUserRolesRes] = await Promise.all([
      supabaseAdmin.from("facilities").select("id, value, label, sort_order, site_id").order("label", { ascending: true }),
      (supabaseAdmin as any).from("content_item_facilities").select("facility_value, content_items(id, title, category_id, categories(id, name))"),
      (supabaseAdmin as any).from("category_facilities").select("facility_value, category_id, categories(id, name, slug)"),
      supabaseAdmin.from("site_settings").select("key, value").like("key", "facility_message_%"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "facilityUser"),
    ]);
    if (facRes.error) throw new Error(facRes.error.message);
    if (cifRes.error) console.warn("[listFacilitiesWithStats] content_item_facilities:", cifRes.error.message);
    if (catFacRes.error) console.warn("[listFacilitiesWithStats] category_facilities:", catFacRes.error.message);

    const facilityMessageMap = new Map<string, string>();
    for (const row of msgRes.data ?? []) {
      const val = (row as any).value as { enabled?: boolean; message?: string } | null;
      const text = val?.message?.trim();
      if (text) {
        const facilityValue = ((row as any).key as string).replace("facility_message_", "");
        facilityMessageMap.set(facilityValue, text);
      }
    }

    const facilityUserIds = new Set<string>(
      (facilityUserRolesRes.data ?? []).map((r: any) => r.user_id as string)
    );

    // Paginate user_profiles to avoid the 1000-row default cap; exclude synthetic + facilityUser accounts
    const userCounts = new Map<string, number>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data: profPage, error: profErr } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id, facility")
        .eq("is_synthetic", false)
        .range(from, from + PAGE - 1);
      if (profErr) throw new Error(profErr.message);
      for (const p of profPage ?? []) {
        if (facilityUserIds.has(p.user_id)) continue;
        const k = p.facility as string;
        if (k) userCounts.set(k, (userCounts.get(k) ?? 0) + 1);
      }
      if ((profPage?.length ?? 0) < PAGE) break;
    }

    const facilityCategoryMap = new Map<string, Array<{ id: string; name: string; slug: string }>>();
    for (const row of catFacRes.data ?? []) {
      const cat = (row as any).categories;
      if (!cat) continue;
      const fv = (row as any).facility_value as string;
      const arr = facilityCategoryMap.get(fv) ?? [];
      arr.push({ id: cat.id as string, name: cat.name as string, slug: cat.slug as string });
      facilityCategoryMap.set(fv, arr);
    }

    const facilityContentMap = new Map<string, Array<{ id: string; title: string; categoryId: string; categoryName: string }>>();
    for (const row of cifRes.data ?? []) {
      const item = (row as any).content_items;
      if (!item) continue;
      const fv = (row as any).facility_value as string;
      const arr = facilityContentMap.get(fv) ?? [];
      arr.push({
        id: item.id as string,
        title: item.title as string,
        categoryId: item.category_id as string,
        categoryName: (item.categories?.name ?? "") as string,
      });
      facilityContentMap.set(fv, arr);
    }

    return {
      facilities: (facRes.data ?? []).map((f: any) => ({
        id: f.id as string,
        value: f.value as string,
        label: f.label as string,
        sort_order: f.sort_order as number,
        siteId: (f.site_id ?? null) as string | null,
        userCount: userCounts.get(f.value as string) ?? 0,
        contentItems: facilityContentMap.get(f.value as string) ?? [],
        customCategories: facilityCategoryMap.get(f.value as string) ?? [],
        facilityMessage: facilityMessageMap.get(f.value as string) ?? null,
      })),
    };
  });

function deriveValue(siteId: string): string {
  return siteId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export const addFacilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        facilities: z
          .array(
            z.object({
              label: z.string().trim().min(1).max(100),
              siteId: z.string().trim().min(1).max(64),
            }),
          )
          .min(1)
          .max(50),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: existing } = await supabaseAdmin
      .from("facilities")
      .select("value, label, sort_order, site_id");
    const usedValues = new Set((existing ?? []).map((r) => r.value as string));
    const usedLabels = new Set((existing ?? []).map((r) => (r.label as string).trim().toLowerCase()));
    const usedSiteIds = new Set((existing ?? []).map((r) => r.site_id as string).filter(Boolean));
    const maxOrder = (existing ?? []).reduce(
      (m, r) => Math.max(m, (r.sort_order as number) ?? 0),
      -1,
    );

    const rows: { value: string; label: string; sort_order: number; site_id: string }[] = [];
    const duplicates: string[] = [];
    let next = maxOrder + 1;
    for (const f of data.facilities) {
      const label = f.label.trim();
      const siteId = f.siteId.trim();
      const base = deriveValue(siteId);
      if (!base) continue;
      const labelKey = label.toLowerCase();
      if (usedValues.has(base) || usedLabels.has(labelKey) || usedSiteIds.has(siteId)) {
        duplicates.push(label);
        continue;
      }
      usedValues.add(base);
      usedLabels.add(labelKey);
      usedSiteIds.add(siteId);
      rows.push({ value: base, label, sort_order: next++, site_id: siteId });
    }
    if (!rows.length) return { ok: true, inserted: 0, duplicates };

    const { error } = await supabaseAdmin.from("facilities").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, inserted: rows.length, duplicates };
  });


export const updateFacility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().trim().min(1).max(100),
        siteId: z.string().trim().min(1).max(64).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.siteId) {
      const { data: conflict } = await supabaseAdmin
        .from("facilities")
        .select("id")
        .eq("site_id", data.siteId)
        .neq("id", data.id)
        .maybeSingle();
      if (conflict) throw new Error("That Site ID is already in use by another facility.");
      const { error } = await supabaseAdmin
        .from("facilities")
        .update({ label: data.label, site_id: data.siteId })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const patch: Record<string, unknown> = { label: data.label };
      if (data.siteId === null) patch.site_id = null;
      const { error } = await supabaseAdmin.from("facilities").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteFacility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("facilities")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFacilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("facilities")
      .delete()
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: data.ids.length };
  });
