-- Wrapper for refresh_analytics_stats() that can be called via the Supabase REST API.
-- refresh_analytics_stats() uses bare DELETE FROM (no WHERE clause) on analytics_retention
-- and analytics_weekly_growth, which PostgREST rejects as a safety measure.
-- This wrapper TRUNCATEs those tables first so the internal DELETE runs against 0 rows
-- and succeeds without a WHERE clause issue.
-- pg_cron continues to call refresh_analytics_stats() directly (no issue there).
-- JavaScript callers use db.rpc('refresh_nightly') instead.
CREATE OR REPLACE FUNCTION public.refresh_nightly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  TRUNCATE analytics_retention;
  TRUNCATE analytics_weekly_growth;
  PERFORM refresh_analytics_stats();
END;
$$;
