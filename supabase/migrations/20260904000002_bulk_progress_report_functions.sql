-- getBulkFacilityProgressReport (the "Export All Progress" CSV feature)
-- needs full row-level detail — every user's every completed item,
-- bookmark, rating, etc. — not a summary, so unlike report_content_openers/
-- report_content_time_totals this isn't a GROUP BY candidate. Its actual
-- problem was structural: fetching 6 tables via chunkIds(userIds) (to stay
-- under a GET request's URL length limit) crossed with a 1000-row .range()
-- pagination loop *per chunk*, multiplying round trips by chunk count.
-- RPC calls take their parameters in a POST body, not a URL query string,
-- so the chunking is unnecessary once these become functions — every one
-- of them takes the full user_id array directly.

CREATE OR REPLACE FUNCTION public.report_bulk_user_progress(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, content_item_id uuid, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ucp.user_id, ucp.content_item_id, ucp.created_at
  FROM user_content_progress ucp
  WHERE ucp.user_id = ANY(p_user_ids);
$$;

CREATE OR REPLACE FUNCTION public.report_bulk_user_engagement(p_user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  content_item_id uuid,
  session_seconds integer,
  media_progress_seconds numeric,
  media_duration_seconds numeric,
  manual_completion_pct integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT uce.user_id, uce.content_item_id, uce.session_seconds,
         uce.media_progress_seconds, uce.media_duration_seconds, uce.manual_completion_pct
  FROM user_content_engagement uce
  WHERE uce.user_id = ANY(p_user_ids);
$$;

CREATE OR REPLACE FUNCTION public.report_bulk_user_bookmarks(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, content_item_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ucb.user_id, ucb.content_item_id
  FROM user_content_bookmarks ucb
  WHERE ucb.user_id = ANY(p_user_ids);
$$;

CREATE OR REPLACE FUNCTION public.report_bulk_user_ratings(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, content_item_id uuid, rating smallint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ucr.user_id, ucr.content_item_id, ucr.rating
  FROM user_content_ratings ucr
  WHERE ucr.user_id = ANY(p_user_ids);
$$;

CREATE OR REPLACE FUNCTION public.report_bulk_user_logins(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, login_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT ul.user_id, ul.login_date
  FROM user_logins ul
  WHERE ul.user_id = ANY(p_user_ids)
  ORDER BY ul.login_date DESC;
$$;

CREATE OR REPLACE FUNCTION public.report_bulk_user_stats(p_user_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  items_completed integer,
  total_session_seconds integer,
  facility_percentile numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT us.user_id, us.items_completed, us.total_session_seconds::integer, us.facility_percentile
  FROM user_stats us
  WHERE us.user_id = ANY(p_user_ids);
$$;
