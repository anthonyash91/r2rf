-- Reconciles migration history with the actual live schema (found via a
-- systematic audit — see project notes). Everything here is written to be a
-- no-op against the current live database; it only changes what a FRESH
-- rebuild from these migrations would produce, so it matches production.

-- analytics_retention / analytics_weekly_growth / analytics_program_completion:
-- their CREATE TABLE IF NOT EXISTS (in 20260611000002_create_missing_tables.sql)
-- declares a surrogate `id uuid PRIMARY KEY`, but none of the three tables
-- actually has an id column live — they use a natural key instead
-- (facility_value, or category_id+facility_value), matching how
-- refresh_analytics_stats() upserts into them. That CREATE TABLE never
-- actually executed as written: the tables must have already existed in
-- this id-less shape before that migration was added, making it a silent
-- no-op. Drop the phantom column so a fresh rebuild matches production.
ALTER TABLE public.analytics_retention DROP COLUMN IF EXISTS id;
ALTER TABLE public.analytics_weekly_growth DROP COLUMN IF EXISTS id;
ALTER TABLE public.analytics_program_completion DROP COLUMN IF EXISTS id;

-- content_item_openers / content_item_time_totals: both have a live
-- updated_at column that no migration ever added.
ALTER TABLE public.content_item_openers
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.content_item_time_totals
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- user_content_engagement: live has `id` (now the actual primary key,
-- confirmed via schema introspection) and `created_at`, neither in any
-- migration. The original composite PRIMARY KEY (user_id, content_item_id)
-- was swapped for a surrogate id key directly against the live database at
-- some point. A unique constraint on (user_id, content_item_id) must still
-- exist in some form — the app's upsert(..., { onConflict:
-- "user_id,content_item_id" }) in use-content-engagement.ts demonstrably
-- works today, which requires it.
ALTER TABLE public.user_content_engagement
  ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  current_pk_cols text;
BEGIN
  -- Only touch the primary key if it's still the original composite one
  -- (a fresh rebuild) — no-op on live, where it's already on id.
  SELECT string_agg(a.attname, ',' ORDER BY a.attnum) INTO current_pk_cols
  FROM pg_constraint c
  JOIN LATERAL unnest(c.conkey) AS k(attnum) ON true
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
  WHERE c.conrelid = 'public.user_content_engagement'::regclass AND c.contype = 'p';

  IF current_pk_cols = 'user_id,content_item_id' THEN
    ALTER TABLE public.user_content_engagement DROP CONSTRAINT user_content_engagement_pkey;
    ALTER TABLE public.user_content_engagement ADD CONSTRAINT user_content_engagement_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Ensure the natural key stays unique regardless of what it's actually
-- named on live — CREATE UNIQUE INDEX IF NOT EXISTS only skips by name, so
-- if live's existing unique index/constraint has a different name than
-- this, it'll add a second, redundant-but-harmless index rather than error.
-- Worth a manual check later (SELECT * FROM pg_indexes WHERE tablename =
-- 'user_content_engagement') to drop a duplicate if one turns up.
CREATE UNIQUE INDEX IF NOT EXISTS user_content_engagement_user_content_key
  ON public.user_content_engagement (user_id, content_item_id);
