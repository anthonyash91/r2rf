-- Enable RLS on two tables that were missing it.
--
-- analytics_daily_counts: created without ENABLE ROW LEVEL SECURITY.
--   Pre-aggregated event counts broken down by facility — should not be
--   directly readable by regular users. All app reads go through server
--   functions using the service role (bypasses RLS), so locking this down
--   has no impact on app behaviour.
--
-- user_logins: a policy ("Admins manage logins") was added in
--   20260611000005_rls_has_role_subquery.sql but RLS was never enabled,
--   making the policy a no-op. Enabling RLS activates the existing policy.

ALTER TABLE public.analytics_daily_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and facility users read daily counts"
  ON public.analytics_daily_counts FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'))
    OR (SELECT public.has_role(auth.uid(), 'facilityUser'))
  );

ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;
-- Policy "Admins manage logins" already exists from 20260611000005 — no new policy needed.
