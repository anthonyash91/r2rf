-- Store email in user_profiles so admin list pages don't need to paginate
-- through all auth.users to resolve emails (Issue 2 from scalability audit).
--
-- Rollout:
--   Phase 1 (this migration): add nullable column, backfill from auth.users.
--   Phase 2 (application code): write email on all profile inserts/updates.
--   Phase 3 (future): add NOT NULL constraint once all rows have been populated.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Backfill emails for all existing accounts from auth.users.
-- auth.users is only accessible from the postgres/service_role context, which
-- is the context migrations run in.
UPDATE public.user_profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.user_id;

-- Partial index: NULL emails (admin/contributor accounts without profiles) are
-- excluded. The index only covers populated rows, keeping it small.
CREATE INDEX IF NOT EXISTS user_profiles_email_idx
  ON public.user_profiles (email)
  WHERE email IS NOT NULL;
