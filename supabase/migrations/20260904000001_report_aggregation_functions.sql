-- Moves two of reports.functions.ts's slow-path aggregations (facility- or
-- date-filtered usage stats) from "paginate every raw row into Node and
-- reduce in JS" to a single GROUP BY in the database. The all-time,
-- no-facility-filter fast path (reading content_item_openers /
-- content_item_time_totals, maintained by the nightly refresh job) is
-- unaffected — this only replaces the two branches that previously looped
-- through analytics_events / user_content_sessions in 1000-row pages.
--
-- p_user_ids: when provided (facility-scoped view), restrict to exactly
-- these users. p_exclude_ids: when p_user_ids is NULL (overall view),
-- exclude staff/synthetic accounts instead. Callers pass exactly one of the
-- two meaningfully (the other as NULL/empty) — mirroring the JS branching
-- this replaces.

CREATE OR REPLACE FUNCTION public.report_content_openers(
  p_since timestamptz,
  p_user_ids uuid[],
  p_exclude_ids uuid[]
)
RETURNS TABLE(content_item_id uuid, opener_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Cast to integer (not the natural bigint COUNT() returns): PostgREST
  -- serializes bigint as a JSON string to avoid precision loss for very
  -- large values, which would silently break the JS side's `+=` arithmetic
  -- (0 + "120" is string concatenation, not addition). integer is always a
  -- bare JSON number, and these counts are nowhere near int4's ~2.1 billion
  -- ceiling.
  SELECT ae.content_id AS content_item_id, COUNT(DISTINCT ae.user_id)::integer AS opener_count
  FROM analytics_events ae
  WHERE ae.event_type = 'content_click'
    AND ae.user_id IS NOT NULL
    AND (p_since IS NULL OR ae.created_at >= p_since)
    AND (
      (p_user_ids IS NOT NULL AND ae.user_id = ANY(p_user_ids))
      OR (p_user_ids IS NULL AND NOT (ae.user_id = ANY(p_exclude_ids)))
    )
  GROUP BY ae.content_id;
$$;

CREATE OR REPLACE FUNCTION public.report_content_time_totals(
  p_since timestamptz,
  p_user_ids uuid[],
  p_exclude_ids uuid[]
)
RETURNS TABLE(content_item_id uuid, total_session_seconds integer, engager_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Same integer-cast reasoning as report_content_openers above.
  SELECT
    ucs.content_item_id,
    SUM(ucs.session_seconds) FILTER (WHERE ucs.session_seconds > 0)::integer AS total_session_seconds,
    COUNT(*) FILTER (WHERE ucs.session_seconds > 0)::integer AS engager_count
  FROM user_content_sessions ucs
  WHERE (p_since IS NULL OR ucs.recorded_at >= p_since)
    AND (
      (p_user_ids IS NOT NULL AND ucs.user_id = ANY(p_user_ids))
      OR (p_user_ids IS NULL AND NOT (ucs.user_id = ANY(p_exclude_ids)))
    )
  GROUP BY ucs.content_item_id;
$$;
