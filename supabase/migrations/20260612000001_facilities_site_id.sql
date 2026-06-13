-- Add site_id to facilities.
-- site_id is assigned by an external system and passed via URL parameter
-- (?site=<site_id>) on facility tablets for inmate auto-login.
-- Required for all facilities — no facility can be created without one.
--
-- The column previously existed as custom_slug (added via dashboard and renamed).
-- The table was truncated before this migration ran, so no backfill is needed.

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS site_id text;

ALTER TABLE public.facilities
  ALTER COLUMN site_id SET NOT NULL;

-- Rename legacy index if it exists (was created under the old custom_slug name).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'facilities'
      AND indexname  = 'facilities_custom_slug_unique'
  ) THEN
    ALTER INDEX public.facilities_custom_slug_unique
      RENAME TO facilities_site_id_unique;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS facilities_site_id_unique
  ON public.facilities (site_id);
