-- Extend analytics trigger to also skip facilityUser role.

CREATE OR REPLACE FUNCTION analytics_increment_daily_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_facility     text    := '';
  v_is_synthetic boolean := false;
  v_role         text    := '';
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT
      COALESCE(facility, ''),
      COALESCE(is_synthetic, false)
    INTO v_facility, v_is_synthetic
    FROM user_profiles
    WHERE user_id = NEW.user_id;

    IF v_is_synthetic THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(role, '')
    INTO v_role
    FROM user_roles
    WHERE user_id = NEW.user_id
    LIMIT 1;

    IF v_role IN ('admin', 'contributor', 'facilityUser') THEN
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
