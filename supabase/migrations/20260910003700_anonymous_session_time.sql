-- Extends anonymous (signed-out) usage tracking to session time, the same
-- way an earlier migration extended it to click/view counts. Signed-out
-- visitors already generate real engagement (watching videos, reading PDFs)
-- but none of it was recorded — the heartbeat that logs it required a real
-- user_id from the start. user_content_sessions is an append-only "one row
-- per session close" log (no resume-position concerns, unlike
-- user_content_engagement, which stays login-only since there's no stable
-- identity to resume anything for), so it can safely accept anonymous rows
-- attributed by facility_value instead of user_id — exactly the pattern
-- already used for analytics_events / analytics_daily_counts.

ALTER TABLE public.user_content_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_content_sessions ADD COLUMN IF NOT EXISTS facility_value text;

DROP POLICY IF EXISTS "Users insert own sessions" ON public.user_content_sessions;
CREATE POLICY "Users insert own sessions"
  ON public.user_content_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- report_content_time_totals: for a facility-scoped query, anonymous rows
-- (user_id IS NULL) are matched by facility_value instead of user_id
-- membership. For the overall (unfiltered) view, anonymous rows are always
-- included alongside every non-excluded logged-in user.
CREATE OR REPLACE FUNCTION public.report_content_time_totals(
  p_since timestamptz,
  p_user_ids uuid[],
  p_exclude_ids uuid[],
  p_facility_value text DEFAULT NULL
)
RETURNS TABLE(content_item_id uuid, total_session_seconds integer, engager_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ucs.content_item_id,
    SUM(ucs.session_seconds) FILTER (WHERE ucs.session_seconds > 0)::integer AS total_session_seconds,
    COUNT(*) FILTER (WHERE ucs.session_seconds > 0)::integer AS engager_count
  FROM user_content_sessions ucs
  WHERE (p_since IS NULL OR ucs.recorded_at >= p_since)
    AND (
      (p_user_ids IS NOT NULL AND (
        ucs.user_id = ANY(p_user_ids)
        OR (ucs.user_id IS NULL AND p_facility_value IS NOT NULL AND ucs.facility_value = p_facility_value)
      ))
      OR (p_user_ids IS NULL AND (
        ucs.user_id IS NULL
        OR NOT (ucs.user_id = ANY(p_exclude_ids))
      ))
    )
  GROUP BY ucs.content_item_id;
$$;
