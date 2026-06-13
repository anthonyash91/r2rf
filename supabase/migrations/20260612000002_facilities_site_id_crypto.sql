-- Replace plaintext site_id with two protected columns:
--   site_id_hmac      — HMAC-SHA256 of the site ID, used for fast indexed lookups.
--   site_id_encrypted — AES-256-GCM ciphertext, decrypted server-side for admin display.
--
-- A raw DB dump reveals neither the original site IDs nor any information that
-- maps them to facilities. The app server holds the keys in env vars
-- (SITE_ID_HMAC_SECRET, SITE_ID_ENCRYPTION_KEY) and never persists plaintext.
--
-- The facilities table was truncated before this migration, so no backfill is needed.

ALTER TABLE public.facilities DROP COLUMN IF EXISTS site_id;

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS site_id_hmac text,
  ADD COLUMN IF NOT EXISTS site_id_encrypted text;

ALTER TABLE public.facilities
  ALTER COLUMN site_id_hmac SET NOT NULL,
  ALTER COLUMN site_id_encrypted SET NOT NULL;

-- Drop legacy indexes left over from the custom_slug / site_id era.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='facilities' AND indexname='facilities_site_id_unique') THEN
    DROP INDEX public.facilities_site_id_unique;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='facilities' AND indexname='facilities_custom_slug_unique') THEN
    DROP INDEX public.facilities_custom_slug_unique;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS facilities_site_id_hmac_unique
  ON public.facilities (site_id_hmac);
