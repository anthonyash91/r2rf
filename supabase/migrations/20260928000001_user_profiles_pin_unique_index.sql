-- Enforce PIN uniqueness per facility at the database level. Previously only
-- an ordinary (non-unique) index existed (user_profiles_inmate_pin_hmac_facility_idx,
-- see 20260610000001_inmate_pin_hmac.sql), so two concurrent signups with the
-- same PIN could both pass the application-level uniqueness check and both
-- insert successfully — a real race under load (e.g. a facility onboarding
-- many tablets at once).
--
-- Confirmed no existing duplicate (facility, inmate_pin_hmac) pairs in
-- production before adding this (deployment-readiness audit, 2026-09-28), so
-- no backfill/cleanup step is needed.
--
-- Partial (WHERE inmate_pin_hmac IS NOT NULL) because non-inmate accounts
-- (admin, contributor, facilityUser, tester) have no PIN — a plain unique
-- index already treats NULLs as distinct, but the partial form is more
-- explicit and keeps the index smaller.
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_facility_pin_unique
  ON public.user_profiles (facility, inmate_pin_hmac)
  WHERE inmate_pin_hmac IS NOT NULL;
