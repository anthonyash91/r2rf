import { supabase } from "@/integrations/supabase/client";
import { getCachedUserId } from "@/hooks/use-auth";

// Fire-and-forget. Never throws — analytics should never break the UI.

type AnalyticsEvent = {
  event_type: "category_view" | "content_click";
  category_id: string | null;
  content_id?: string;
  user_id: string | null;
};

let buffer: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const FLUSH_INTERVAL_MS = 5000;

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
}

function flush() {
  flushTimer = null;
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  void supabase
    .from("analytics_events")
    .insert(batch)
    .then(({ error }) => {
      if (error) console.warn("analytics flush failed", error.message);
    });
}

// Flush on tab hide (covers mobile background) and page close (desktop).
// Guard for SSR — this module may be imported on the server.
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("beforeunload", flush);
}

export function trackCategoryView(categoryId: string) {
  buffer.push({ event_type: "category_view", category_id: categoryId, user_id: getCachedUserId() });
  scheduleFlush();
}

export function trackContentClick(contentId: string, categoryId: string | null) {
  buffer.push({ event_type: "content_click", content_id: contentId, category_id: categoryId, user_id: getCachedUserId() });
  scheduleFlush();
}
