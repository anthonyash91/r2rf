-- Revoke public execute on refresh_nightly() so it cannot be called directly
-- via the Supabase REST API by any authenticated user. The TypeScript server
-- function (triggerNightlyRefresh) uses supabaseAdmin (service_role) which
-- retains execute permission. pg_cron calls refresh_analytics_stats() directly
-- and is unaffected.
REVOKE EXECUTE ON FUNCTION public.refresh_nightly() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_nightly() TO service_role;

-- Composite index for the content_item_openers trigger:
-- On every analytics_events INSERT, the trigger runs:
--   WHERE user_id = $1 AND content_id = $2 AND event_type = 'content_click'
-- Individual indexes on each column require a bitmap AND — this composite
-- index handles the full predicate in one scan.
CREATE INDEX IF NOT EXISTS analytics_events_opener_check_idx
  ON public.analytics_events (user_id, content_id, event_type);

-- Composite indexes for monthly summary date-range queries:
CREATE INDEX IF NOT EXISTS user_content_sessions_user_date_idx
  ON public.user_content_sessions (user_id, recorded_at);

CREATE INDEX IF NOT EXISTS user_content_progress_user_created_idx
  ON public.user_content_progress (user_id, created_at);
