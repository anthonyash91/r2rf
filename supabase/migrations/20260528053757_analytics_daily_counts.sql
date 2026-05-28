-- Pre-aggregated analytics counts bucketed by day.
-- The trigger below keeps this table in sync automatically so the
-- reports page never has to scan raw analytics_events rows.

CREATE TABLE analytics_daily_counts (
  event_type    text  NOT NULL,
  category_id   uuid,
  content_id    uuid,
  facility_value text  NOT NULL DEFAULT '',
  period_date   date  NOT NULL,
  count         integer NOT NULL DEFAULT 0,
  CONSTRAINT analytics_daily_counts_unique
    UNIQUE NULLS NOT DISTINCT (event_type, category_id, content_id, facility_value, period_date)
);

CREATE INDEX analytics_daily_counts_date_idx     ON analytics_daily_counts (period_date);
CREATE INDEX analytics_daily_counts_facility_idx ON analytics_daily_counts (facility_value);
CREATE INDEX analytics_daily_counts_category_idx ON analytics_daily_counts (category_id);

-- ---------------------------------------------------------------------------
-- Trigger: increment counts whenever a raw event is inserted.
-- Looks up the user's facility and excludes synthetic (test) users.
-- ---------------------------------------------------------------------------
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

    -- Skip synthetic / tester accounts entirely
    IF v_is_synthetic THEN
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

CREATE TRIGGER analytics_event_count_trigger
AFTER INSERT ON analytics_events
FOR EACH ROW EXECUTE FUNCTION analytics_increment_daily_count();

-- ---------------------------------------------------------------------------
-- Backfill: seed counts from every existing analytics_event row,
-- excluding synthetic users, preserving the original event date.
-- ---------------------------------------------------------------------------
INSERT INTO analytics_daily_counts
  (event_type, category_id, content_id, facility_value, period_date, count)
SELECT
  e.event_type,
  e.category_id,
  e.content_id,
  COALESCE(p.facility, '') AS facility_value,
  e.created_at::date       AS period_date,
  COUNT(*)                 AS count
FROM analytics_events e
LEFT JOIN user_profiles p
  ON p.user_id = e.user_id AND COALESCE(p.is_synthetic, false) = false
WHERE
  e.user_id IS NULL
  OR (
    p.user_id IS NOT NULL               -- matched profile that is not synthetic
  )
GROUP BY
  e.event_type,
  e.category_id,
  e.content_id,
  COALESCE(p.facility, ''),
  e.created_at::date
ON CONFLICT ON CONSTRAINT analytics_daily_counts_unique
DO UPDATE SET count = analytics_daily_counts.count + EXCLUDED.count;
