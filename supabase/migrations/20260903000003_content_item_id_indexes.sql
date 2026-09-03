-- These tables each have a composite PRIMARY KEY led by user_id (e.g.
-- PRIMARY KEY (user_id, content_item_id)), which makes "everything for this
-- user" lookups fast automatically but does nothing for the opposite
-- direction — "everything for this content item, across all users" — since
-- content_item_id is the trailing column, not the leading one. That
-- direction is what the nightly refresh_analytics_stats() job and several
-- admin report queries in reports.functions.ts actually need, and currently
-- falls back to a sequential scan. Cheap to add now while these tables are
-- small; index builds get more disruptive the larger a table gets.
CREATE INDEX IF NOT EXISTS idx_user_content_engagement_content_item
  ON public.user_content_engagement (content_item_id);

CREATE INDEX IF NOT EXISTS idx_user_content_bookmarks_content_item
  ON public.user_content_bookmarks (content_item_id);

CREATE INDEX IF NOT EXISTS idx_user_content_ratings_content_item
  ON public.user_content_ratings (content_item_id);

CREATE INDEX IF NOT EXISTS idx_user_chapter_progress_content_item
  ON public.user_chapter_progress (content_item_id);
