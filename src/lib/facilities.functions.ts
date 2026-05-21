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
    .select("id, value, label, sort_order")
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

    const [facRes, profRes, pagesRes, linksRes, catsRes] = await Promise.all([
      supabaseAdmin.from("facilities").select("id, value, label, sort_order").order("label", { ascending: true }),
      supabaseAdmin.from("user_profiles").select("facility"),
      supabaseAdmin.from("custom_home_pages").select("id, name, slug"),
      supabaseAdmin.from("custom_home_page_categories").select("custom_home_page_id, category_id"),
      supabaseAdmin.from("categories").select("id, name, slug, sort_order, home_page_mode").eq("home_page_mode", "custom").order("sort_order", { ascending: true }),
    ]);
    if (facRes.error) throw new Error(facRes.error.message);
    if (profRes.error) throw new Error(profRes.error.message);
    if (pagesRes.error) throw new Error(pagesRes.error.message);
    if (linksRes.error) throw new Error(linksRes.error.message);
    if (catsRes.error) throw new Error(catsRes.error.message);

    const userCounts = new Map<string, number>();
    for (const p of profRes.data ?? []) {
      const k = (p as any).facility as string;
      userCounts.set(k, (userCounts.get(k) ?? 0) + 1);
    }

    const catsById = new Map<string, { id: string; name: string; slug: string }>();
    for (const c of catsRes.data ?? []) {
      catsById.set((c as any).id, { id: (c as any).id, name: (c as any).name, slug: (c as any).slug });
    }
    const pageCats = new Map<string, { id: string; name: string; slug: string }[]>();
    for (const l of linksRes.data ?? []) {
      const pid = (l as any).custom_home_page_id as string;
      const cat = catsById.get((l as any).category_id);
      if (!cat) continue;
      const arr = pageCats.get(pid) ?? [];
      arr.push(cat);
      pageCats.set(pid, arr);
    }
    const pageByName = new Map<string, { id: string; slug: string; name: string }>();
    for (const pg of pagesRes.data ?? []) {
      pageByName.set((pg as any).name, { id: (pg as any).id, slug: (pg as any).slug, name: (pg as any).name });
    }

    return {
      facilities: (facRes.data ?? []).map((f: any) => {
        const page = pageByName.get(f.label) ?? null;
        return {
          id: f.id as string,
          value: f.value as string,
          label: f.label as string,
          sort_order: f.sort_order as number,
          userCount: userCounts.get(f.value as string) ?? 0,
          customHomePage: page
            ? {
                id: page.id,
                slug: page.slug,
                categories: pageCats.get(page.id) ?? [],
              }
            : null,
        };
      }),
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
      .select("value, sort_order");
    const used = new Set((existing ?? []).map((r) => r.value as string));
    const maxOrder = (existing ?? []).reduce(
      (m, r) => Math.max(m, (r.sort_order as number) ?? 0),
      -1,
    );

    const rows: { value: string; label: string; sort_order: number }[] = [];
    let next = maxOrder + 1;
    for (const f of data.facilities) {
      const base = slugify(f.value || f.label);
      if (!base) continue;
      let value = base;
      let i = 2;
      while (used.has(value)) value = `${base}_${i++}`;
      used.add(value);
      rows.push({ value, label: f.label.trim(), sort_order: next++ });
    }
    if (!rows.length) return { ok: true, inserted: 0 };

    const { error } = await supabaseAdmin.from("facilities").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, inserted: rows.length };
  });

export const updateFacility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().trim().min(1).max(100),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("facilities")
      .update({ label: data.label })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
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
