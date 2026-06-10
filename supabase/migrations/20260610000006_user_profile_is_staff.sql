-- Add is_staff flag to user_profiles (Issues 4 and 11 from scalability audit).
--
-- Eliminates two bottlenecks:
--   1. listRegularUsers fetches all privileged role IDs on every admin page load
--      and builds a NOT IN exclusion list. With is_staff, the query uses a single
--      indexed column predicate instead.
--   2. The analytics_increment_daily_count() trigger makes 2 sequential DB queries
--      per analytics event (user_profiles for facility, user_roles for staff check).
--      With is_staff on user_profiles, the trigger can skip the user_roles lookup.
--
-- Rollout:
--   Phase 1 (this migration): add column, backfill from user_roles.
--   Phase 2 (application code): set is_staff=true on createUser / createFacilityUser
--     / createTesterUser; clear on role removal.
--   Phase 3 (future): update analytics trigger to use is_staff instead of user_roles.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT false;

-- Backfill: any user with a privileged role is staff.
UPDATE public.user_profiles p
SET is_staff = true
WHERE EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = p.user_id
    AND r.role IN ('admin', 'contributor', 'tester', 'facilityUser')
);

-- Index: admin queries filter on is_staff = false (the common/large set).
-- A partial index on the rare true rows keeps the main table scan fast.
CREATE INDEX IF NOT EXISTS user_profiles_is_staff_idx
  ON public.user_profiles (is_staff)
  WHERE is_staff = true;
