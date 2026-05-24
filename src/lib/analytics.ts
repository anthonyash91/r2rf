import { supabase } from "@/integrations/supabase/client";

// Fire-and-forget. Never throws — analytics should never break the UI.
async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export function trackCategoryView(categoryId: string) {
  void currentUserId().then((user_id) =>
    supabase
      .from("analytics_events")
      .insert({ event_type: "category_view", category_id: categoryId, user_id })
      .then(({ error }) => {
        if (error) console.warn("trackCategoryView failed", error.message);
      }),
  );
}

export function trackContentClick(contentId: string, categoryId: string | null) {
  void currentUserId().then((user_id) =>
    supabase
      .from("analytics_events")
      .insert({ event_type: "content_click", content_id: contentId, category_id: categoryId, user_id })
      .then(({ error }) => {
        if (error) console.warn("trackContentClick failed", error.message);
      }),
  );
}
