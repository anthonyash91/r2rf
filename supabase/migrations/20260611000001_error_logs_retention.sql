-- Automatic retention for error_logs (Issue 11 — infrastructure audit).
-- error_logs has a manual clearOldErrorLogs admin function but no scheduled
-- cleanup. A render loop or bot hammering /api/public/log-error can fill
-- the table with junk even with the per-IP rate limit.
-- 30 days matches the default in the admin UI clear function.
SELECT cron.schedule(
  'prune-error-logs',
  '30 3 * * *',  -- 3:30 AM UTC nightly, offset from the analytics job at 3:00 AM
  $$
    DELETE FROM public.error_logs
    WHERE created_at < now() - interval '30 days';
  $$
);
