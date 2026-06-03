import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyBookmarkIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("user_content_bookmarks")
      .select("content_item_id");
    if (error) throw error;
    return { ids: (data ?? []).map((r: any) => r.content_item_id as string) };
  });

export const toggleBookmark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ contentItemId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    // Read the current state first so the toggle is idempotent — calling
    // this twice quickly always lands in the correct final state.
    const { data: existing } = await (context.supabase as any)
      .from("user_content_bookmarks")
      .select("content_item_id")
      .eq("content_item_id", data.contentItemId)
      .maybeSingle();

    if (existing) {
      await (context.supabase as any)
        .from("user_content_bookmarks")
        .delete()
        .eq("user_id", context.userId)
        .eq("content_item_id", data.contentItemId);
      return { bookmarked: false };
    } else {
      await (context.supabase as any)
        .from("user_content_bookmarks")
        .insert({ user_id: context.userId, content_item_id: data.contentItemId });
      return { bookmarked: true };
    }
  });

export const getMyBookmarkedItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("user_content_bookmarks")
      .select(`
        content_item_id,
        created_at,
        content_items!inner(
          id, title, type, description, url, file_url,
          categories!inner(id, name, name_es, slug, icon_name, icon_color)
        )
      `)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { items: (data ?? []) as any[] };
  });
