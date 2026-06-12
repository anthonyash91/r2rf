import { supabase } from "@/integrations/supabase/client";
import { getCachedUserId } from "@/hooks/use-auth";

// Fire-and-forget. Never throws — analytics should never break the UI.

export function trackCategoryView(categoryId: string) {
  const user_id = getCachedUserId();
  void supabase
    .from("analytics_events")
    .insert({ event_type: "category_view", category_id: categoryId, user_id })
    .then(({ error }) => {
      if (error) console.warn("trackCategoryView failed", error.message);
    });
}

export function trackContentClick(contentId: string, categoryId: string | null) {
  const user_id = getCachedUserId();
  void supabase
    .from("analytics_events")
    .insert({ event_type: "content_click", content_id: contentId, category_id: categoryId, user_id })
    .then(({ error }) => {
      if (error) console.warn("trackContentClick failed", error.message);
    });
}
