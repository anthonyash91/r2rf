-- Fix analytics_increment_daily_count() so testers with analytics tracking
-- enabled (is_synthetic=false) are counted in the facility report.
--
-- The previous version used LIMIT 1 to fetch one role without ORDER BY.
-- Testers have 5 roles; if admin/contributor/facilityUser was returned first
-- (non-deterministic), their event was silently dropped. This version uses
-- explicit EXISTS checks: testers bypass the staff exclusion entirely when
-- is_synthetic=false, since that flag is already the correct gate.

CREATE OR REPLACE FUNCTION analytics_increment_daily_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facility     text    := '';
  v_is_synthetic boolean := false;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT
      COALESCE(facility, ''),
      COALESCE(is_synthetic, false)
    INTO v_facility, v_is_synthetic
    FROM user_profiles
    WHERE user_id = NEW.user_id;

    -- Skip synthetic users (testers with analytics tracking off)
    IF v_is_synthetic THEN
      RETURN NEW;
    END IF;

    -- Skip non-tester staff (admin, contributor, facilityUser).
    -- Testers pass through here — is_synthetic=false is the correct gate for them.
    IF EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = NEW.user_id AND role IN ('admin', 'contributor', 'facilityUser')
    ) AND NOT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = NEW.user_id AND role = 'tester'
    ) THEN
      RETURN NEW;
    END IF;

    v_facility := COALESCE(v_facility, '');
  END IF;

  INSERT INTO analytics_daily_counts
    (event_type, category_id, content_id, facility_value, period_date, count)
  VALUES
    (NEW.event_type, NEW.category_id, NEW.content_id, v_facility, CURRENT_DATE, 1)
  ON CONFLICT ON CONSTRAINT analytics_daily_counts_unique
  DO UPDATE SET count = analytics_daily_counts.count + 1;

  RETURN NEW;
END;
$$;
