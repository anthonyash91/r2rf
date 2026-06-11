-- Issue #8 (database audit): Phase 3 — drop inmate_pin plaintext column.
--
-- !! DO NOT RUN THIS MIGRATION UNTIL: !!
--   1. The backfill script has been run:  node migrate-pin-hashes.mjs
--   2. All records with a plaintext PIN now have an HMAC. Verify with:
--        SELECT COUNT(*) FROM public.user_profiles
--        WHERE inmate_pin IS NOT NULL AND inmate_pin_hmac IS NULL;
--      This must return 0 before applying this migration.
--   3. Application code no longer reads inmate_pin (plaintext fallback paths
--      have been removed from user-signup.functions.ts and password-reset.functions.ts).
--
-- After this migration: inmate_pin_hmac becomes NOT NULL for rows that had a PIN.
-- The plaintext column is gone — no recovery without a DB restore.

-- Safety check: abort if any plaintext-only rows still exist.
-- Skipped if inmate_pin is already gone (column never existed, or already dropped).
DO $$
DECLARE remaining integer; col_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'user_profiles'
      AND column_name  = 'inmate_pin'
  ) INTO col_exists;

  IF col_exists THEN
    SELECT COUNT(*) INTO remaining
    FROM public.user_profiles
    WHERE inmate_pin IS NOT NULL AND inmate_pin_hmac IS NULL;

    IF remaining > 0 THEN
      RAISE EXCEPTION
        'Backfill incomplete: % row(s) still have inmate_pin without inmate_pin_hmac. '
        'Run migrate-pin-hashes.mjs first.', remaining;
    END IF;
  END IF;
END $$;

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS inmate_pin;
