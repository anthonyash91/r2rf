import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyRatings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("user_content_ratings")
      .select("content_item_id, rating");
    if (error) throw error;
    const ratings: Record<string, 1 | -1> = {};
    for (const r of (data ?? []) as Array<{ content_item_id: string; rating: number }>) {
      ratings[r.content_item_id] = r.rating as 1 | -1;
    }
    return { ratings };
  });

export const rateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      contentItemId: z.string().uuid(),
      rating: z.union([z.literal(1), z.literal(-1), z.null()]),
    }).parse(input)
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as any;
    const { contentItemId, rating } = data;

    if (rating === null) {
      const { error } = await db
        .from("user_content_ratings")
        .delete()
        .eq("user_id", context.userId)
        .eq("content_item_id", contentItemId);
      if (error) throw error;
      return { rated: false };
    }

    // Check if a rating already exists for this user+item.
    const { data: existing } = await db
      .from("user_content_ratings")
      .select("rating")
      .eq("user_id", context.userId)
      .eq("content_item_id", contentItemId)
      .maybeSingle();

    if (existing) {
      const { error } = await db
        .from("user_content_ratings")
        .update({ rating, updated_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("content_item_id", contentItemId);
      if (error) throw error;
    } else {
      const { error } = await db
        .from("user_content_ratings")
        .insert({ user_id: context.userId, content_item_id: contentItemId, rating });
      if (error) throw error;
    }

    return { rated: true, rating };
  });
