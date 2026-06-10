-- Performance indexes identified in the pre-production audit.
-- These tables are queried on every category page load and analytics report.

-- user_content_engagement: filtered by user_id + category_id on every category page open.
-- Without this index, the DB does a full sequential scan as engagement records grow.
CREATE INDEX IF NOT EXISTS user_content_engagement_user_category_idx
  ON public.user_content_engagement (user_id, category_id);

-- user_content_sessions: queried in analytics for per-user session history.
CREATE INDEX IF NOT EXISTS user_content_sessions_user_category_idx
  ON public.user_content_sessions (user_id, category_id, created_at DESC);
