-- Add is_synthetic flag to user_profiles to distinguish test/synthetic users
-- from real users in analytics and reports.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;

-- Backfill: any user that currently has the tester role is synthetic.
UPDATE public.user_profiles p
SET is_synthetic = true
WHERE EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = p.user_id AND r.role = 'tester'
);

-- Index for fast filtering in analytics joins.
CREATE INDEX IF NOT EXISTS user_profiles_is_synthetic_idx
  ON public.user_profiles (is_synthetic) WHERE is_synthetic = true;