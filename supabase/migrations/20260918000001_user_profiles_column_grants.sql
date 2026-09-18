-- Column-level privilege lockdown for user_profiles — same mechanism used
-- for facilities.site_id_hmac/site_id_encrypted (see
-- 20260903000002_facilities_restrict_site_id_columns.sql). RLS controls
-- which ROWS a role can touch; it says nothing about which COLUMNS within
-- an allowed row are visible or writable — that defaults to "all of them"
-- unless explicitly revoked. Two independent findings prompted this:
--
-- 1) SELECT: RLS already restricts user_profiles to "your own row" (or
--    admin). That's real protection today, not something this migration
--    fixes. This is a second, independent lock: if a future policy change
--    (a facility-scoped SELECT policy, a broadened admin check, a typo in a
--    USING clause) ever widens row access, column grants are a backstop
--    that doesn't depend on that policy being right. Every column a name
--    lives in (first_name, last_name, email, username, inmate_pin_hmac)
--    would otherwise ride along with any such mistake.
--
-- 2) UPDATE: this one IS live today. "Users update own profile" has
--    WITH CHECK (auth.uid() = user_id) — that only pins WHICH ROW can be
--    touched, not WHICH COLUMNS. With no column-level UPDATE grant ever
--    set, a signed-in user can PATCH their own row via the anon/authenticated
--    REST API with ANY column, including `facility` (moving themselves to a
--    different facility's content/attribution), `is_synthetic` (excluding
--    themselves from every analytic), or `inmate_pin_hmac`. None of the
--    client code needs this — the two real direct UPDATEs
--    (category.$slug.tsx, dashboard.tsx) only ever set the two tutorial
--    flags.
--
-- Audited every direct (non-server-function) query against user_profiles in
-- src/routes, src/components, src/hooks to build the lists below:
--   SELECT  facility        — signup.tsx sign-in facility-match check;
--                             admin.audit-log.tsx facility filter
--           user_id         — admin.audit-log.tsx facility filter;
--                             RoleSwitcher.tsx (tester reads own row)
--           is_synthetic    — RoleSwitcher.tsx (tester reads own row)
--   UPDATE  category_tutorial_seen, dashboard_tutorial_seen
--                           — category.$slug.tsx, dashboard.tsx
--
-- Every other read (names, email, admin user list, CSV export, reports) goes
-- through server functions using the service-role client, which bypasses
-- RLS and grants alike — this migration has no effect on any of that.
--
-- anon has no policy on user_profiles at all (every existing policy is
-- "TO authenticated"), so it already can't see any row regardless of
-- columns; revoking here too is belt-and-suspenders, matching the pattern
-- already used for facilities.

REVOKE SELECT, UPDATE ON public.user_profiles FROM anon, authenticated;

GRANT SELECT (user_id, facility, is_synthetic)
  ON public.user_profiles
  TO authenticated;

GRANT UPDATE (category_tutorial_seen, dashboard_tutorial_seen)
  ON public.user_profiles
  TO authenticated;
