-- Anonymous (signed-out) analytics_events rows have no user_id, so the
-- daily-counts trigger had no way to resolve a facility for them and tagged
-- them with an empty facility_value — invisible in every per-facility
-- report, only ever counted in the sitewide Overall totals.
--
-- The client already knows which facility a device belongs to (the same
-- siteID/URL-derived value used to lock the facility field at signup), so
-- anonymous events can now carry it directly. The trigger uses it ONLY as a
-- fallback when there's no logged-in user — a real account's facility is
-- still always resolved from user_profiles, never from this client-supplied
-- value, so a device can't spoof a different facility for an existing user.

ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS facility_value text;

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
  ELSE
    -- Anonymous: fall back to the client-asserted facility (from platform
    -- headers/URL), never trusted over a real user's own profile above.
    v_facility := COALESCE(NEW.facility_value, '');
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
