import { supabase } from "@/integrations/supabase/client";

// Fire-and-forget. Never throws — analytics should never break the UI.
export function trackCategoryView(categoryId: string) {
  void supabase
    .from("analytics_events")
    .insert({ event_type: "category_view", category_id: categoryId })
    .then(({ error }) => {
      if (error) console.warn("trackCategoryView failed", error.message);
    });
}

export function trackContentClick(contentId: string, categoryId: string | null) {
  void supabase
    .from("analytics_events")
    .insert({ event_type: "content_click", content_id: contentId, category_id: categoryId })
    .then(({ error }) => {
      if (error) console.warn("trackContentClick failed", error.message);
    });
}
