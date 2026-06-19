-- Add tutorial completion flags to user_profiles.
-- DEFAULT false means existing users will see the tutorial once on their next visit.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS dashboard_tutorial_seen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category_tutorial_seen boolean NOT NULL DEFAULT false;
