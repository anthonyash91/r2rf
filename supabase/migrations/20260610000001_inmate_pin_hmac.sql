-- Add HMAC hash column for inmate PINs.
-- PINs are facility-assigned identifiers for incarcerated individuals (sensitive PII).
-- Storing them in plaintext risks exposing them on DB breach.
-- inmate_pin_hmac: HMAC-SHA256 of the PIN keyed on SIGNUP_CHALLENGE_SECRET (computed
-- server-side). Deterministic so exact-match lookups work without bcrypt.
-- Rollout is phased:
--   Phase 1 (this migration): add nullable column; new sign-ups write HMAC immediately.
--   Phase 2 (run migrate-pin-hashes.mjs): back-fill HMACs for existing records.
--   Phase 3 (future migration): set inmate_pin NOT NULL, drop plaintext column.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS inmate_pin_hmac text;

-- Index for exact-match lookup (replaces full-column scan on inmate_pin).
CREATE INDEX IF NOT EXISTS user_profiles_inmate_pin_hmac_facility_idx
  ON public.user_profiles (inmate_pin_hmac, facility);
