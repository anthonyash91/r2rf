-- Optimize analytics_increment_daily_count() trigger (Issue 4 from scalability audit).
--
-- Before: the trigger made 2 sequential SELECTs per analytics event INSERT:
--   1. SELECT facility, is_synthetic FROM user_profiles WHERE user_id = NEW.user_id
--   2. SELECT role FROM user_roles WHERE user_id = NEW.user_id LIMIT 1
-- At high event rates this creates a write bottleneck — each INSERT holds its
-- row lock while waiting for two additional DB round-trips.
--
-- After: both checks are satisfied by a single SELECT from user_profiles, which
-- now carries is_synthetic (existing) and is_staff (added in migration 00006).
-- The user_roles lookup is eliminated entirely.

CREATE OR REPLACE FUNCTION analytics_increment_daily_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facility     text    := '';
  v_is_synthetic boolean := false;
  v_is_staff     boolean := false;
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    -- Single query replaces the previous two sequential SELECTs
    SELECT
      COALESCE(facility, ''),
      COALESCE(is_synthetic, false),
      COALESCE(is_staff, false)
    INTO v_facility, v_is_synthetic, v_is_staff
    FROM user_profiles
    WHERE user_id = NEW.user_id;

    -- Skip synthetic / tester accounts and all staff
    IF v_is_synthetic OR v_is_staff THEN
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
