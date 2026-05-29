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
    .select("id, value, label, sort_order, custom_slug")
    .eq("hidden", false)
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return {
    facilities: (data ?? []).map((f) => ({
      id: f.id as string,
      value: f.value as string,
      label: f.label as string,
      sort_order: f.sort_order as number,
      customSlug: (f.custom_slug ?? null) as string | null,
    })),
  };
});

export const listAllFacilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await supabaseAdmin
      .from("facilities")
      .select("id, value, label, sort_order, custom_slug")
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      facilities: (data ?? []).map((f) => ({
        id: f.id as string,
        value: f.value as string,
        label: f.label as string,
        sort_order: f.sort_order as number,
      })),
    };
  });

export const listFacilitiesWithStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);

    const [facRes, profRes, cifRes, catFacRes, msgRes, facilityUserRolesRes] = await Promise.all([
      supabaseAdmin.from("facilities").select("id, value, label, sort_order, custom_slug").order("label", { ascending: true }),
      supabaseAdmin.from("user_profiles").select("user_id, facility"),
      (supabaseAdmin as any).from("content_item_facilities").select("facility_value, content_items(id, title, category_id, categories(id, name))"),
      (supabaseAdmin as any).from("category_facilities").select("facility_value, category_id, categories(id, name, slug)"),
      supabaseAdmin.from("site_settings").select("key, value").like("key", "facility_message_%"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "facilityUser"),
    ]);
    if (facRes.error) throw new Error(facRes.error.message);
    if (profRes.error) throw new Error(profRes.error.message);
    if (cifRes.error) console.warn("[listFacilitiesWithStats] content_item_facilities:", cifRes.error.message);
    if (catFacRes.error) console.warn("[listFacilitiesWithStats] category_facilities:", catFacRes.error.message);

    // Build map of facility value → message text for facilities that have an active message
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
    const userCounts = new Map<string, number>();
    for (const p of profRes.data ?? []) {
      if (facilityUserIds.has((p as any).user_id as string)) continue; // exclude facilityUser accounts
      const k = (p as any).facility as string;
      userCounts.set(k, (userCounts.get(k) ?? 0) + 1);
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
        customSlug: (f.custom_slug ?? null) as string | null,
        userCount: userCounts.get(f.value as string) ?? 0,
        contentItems: facilityContentMap.get(f.value as string) ?? [],
        customCategories: facilityCategoryMap.get(f.value as string) ?? [],
        facilityMessage: facilityMessageMap.get(f.value as string) ?? null,
      })),
    };
  });

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
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
              value: z.string().trim().min(1).max(64).optional(),
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
      .select("value, label, sort_order");
    const usedValues = new Set((existing ?? []).map((r) => r.value as string));
    const usedLabels = new Set((existing ?? []).map((r) => (r.label as string).trim().toLowerCase()));
    const maxOrder = (existing ?? []).reduce(
      (m, r) => Math.max(m, (r.sort_order as number) ?? 0),
      -1,
    );

    const rows: { value: string; label: string; sort_order: number }[] = [];
    const duplicates: string[] = [];
    let next = maxOrder + 1;
    for (const f of data.facilities) {
      const label = f.label.trim();
      const base = slugify(f.value || label);
      if (!base) continue;
      const labelKey = label.toLowerCase();
      if (usedValues.has(base) || usedLabels.has(labelKey)) {
        duplicates.push(label);
        continue;
      }
      usedValues.add(base);
      usedLabels.add(labelKey);
      rows.push({ value: base, label, sort_order: next++ });
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
        customSlug: z.string().trim().max(64).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    // Validate custom slug uniqueness if provided
    if (data.customSlug) {
      const slugified = data.customSlug.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
      const { data: conflict } = await supabaseAdmin
        .from("facilities")
        .select("id")
        .eq("custom_slug", slugified)
        .neq("id", data.id)
        .maybeSingle();
      if (conflict) throw new Error("That custom slug is already in use by another facility.");
      const { error } = await supabaseAdmin
        .from("facilities")
        .update({ label: data.label, custom_slug: slugified })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const patch: Record<string, unknown> = { label: data.label };
      if (data.customSlug === null) patch.custom_slug = null; // explicit clear
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

