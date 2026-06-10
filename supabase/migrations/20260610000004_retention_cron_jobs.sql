-- Data retention pg_cron jobs.
-- Prevents three tables from growing unboundedly:
--   analytics_events      — raw click/view rows; daily counts pre-aggregated, so 90d is enough
--   password_reset_attempts — rate-limit window is 1h; records older than 2h are dead weight
--   signup_attempts       — same rate-limit window pattern; prune after 2h
--
-- Requires pg_cron extension (enabled by default on Supabase Pro).
-- If running on Free tier, apply these DELETEs via a nightly RPC instead.

-- Prune raw analytics events older than 90 days.
-- analytics_daily_counts retains the aggregated summary indefinitely, so no
-- historical data is lost — only the per-row event log is trimmed.
SELECT cron.schedule(
  'prune-analytics-events',
  '0 3 * * *',  -- 3 AM UTC nightly
  $$
    DELETE FROM public.analytics_events
    WHERE created_at < now() - interval '90 days';
  $$
);

-- Prune password reset attempt records older than 2 hours.
-- The rate-limit window is 1 hour (RESET_WINDOW_MS in password-reset.functions.ts),
-- so any record older than 2h is outside every possible rate-limit query window.
SELECT cron.schedule(
  'prune-reset-attempts',
  '10 * * * *',  -- 10 minutes past every hour
  $$
    DELETE FROM public.password_reset_attempts
    WHERE created_at < now() - interval '2 hours';
  $$
);

-- Prune signup attempt records older than 2 hours.
-- Same reasoning as above — the signup challenge window is 1 minute,
-- so records older than 1 hour are far outside every rate-limit window.
SELECT cron.schedule(
  'prune-signup-attempts',
  '15 * * * *',  -- 15 minutes past every hour
  $$
    DELETE FROM public.signup_attempts
    WHERE created_at < now() - interval '2 hours';
  $$
);
