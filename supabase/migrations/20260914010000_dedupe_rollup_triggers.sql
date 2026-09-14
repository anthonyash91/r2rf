-- content_item_time_totals and content_item_openers were each being
-- maintained by TWO triggers simultaneously — an older pair
-- (tr_content_item_time_totals / tr_content_item_openers, both in
-- 20260611000002_create_missing_tables.sql) and a newer, undocumented
-- "sync_" pair that was never captured in a migration (this app has had
-- schema-drift issues before — see 20260903000004_reconcile_schema_drift.sql
-- — this is another instance of the same pattern: a change made directly in
-- the Supabase dashboard, not through migrations).
--
-- Both pairs fire on every insert and both write to the same rollup row,
-- so every session and every first-time open was counted twice. The newer
-- "sync_" functions are also the more complete ones (they correctly exclude
-- staff/tester/synthetic accounts, which the older pair never did), so they
-- read as the intended replacement that just never got the old one dropped
-- — kept below, not the other way around.
--
-- sync_content_item_time_totals itself has one remaining bug: its engager
-- dedup subquery does `user_id = NEW.user_id`, which is never true when
-- NEW.user_id is NULL (anonymous sessions) — SQL requires `IS NULL` for
-- that comparison. So every anonymous session's contribution to
-- engager_count silently evaluated to 0. Fixed below: an anonymous session
-- can't be deduplicated against a stable identity anyway, so every
-- anonymous row counts as its own engager.

-- Also undocumented: both sync_ functions write an updated_at column that
-- isn't in either table's original CREATE TABLE migration — it exists live
-- (same dashboard-drift pattern), so a fresh environment built from
-- migrations alone would otherwise fail here. Reconciling it now.
ALTER TABLE public.content_item_time_totals ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.content_item_openers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS tr_content_item_time_totals ON public.user_content_sessions;
DROP FUNCTION IF EXISTS public.increment_content_item_time_totals();

DROP TRIGGER IF EXISTS tr_content_item_openers ON public.analytics_events;
DROP FUNCTION IF EXISTS public.increment_content_item_openers();

CREATE OR REPLACE FUNCTION public.sync_content_item_time_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = NEW.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = NEW.user_id AND up.is_synthetic = true) THEN RETURN NEW; END IF;

  INSERT INTO content_item_time_totals (content_item_id, total_session_seconds, engager_count, updated_at)
  VALUES (NEW.content_item_id, NEW.session_seconds, 1, now())
  ON CONFLICT (content_item_id) DO UPDATE SET
    total_session_seconds = content_item_time_totals.total_session_seconds + NEW.session_seconds,
    engager_count = content_item_time_totals.engager_count + (
      CASE
        WHEN NEW.user_id IS NULL THEN 1
        ELSE (
          SELECT CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END
          FROM user_content_sessions WHERE user_id = NEW.user_id AND content_item_id = NEW.content_item_id
        )
      END
    ),
    updated_at = now();

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sync_time_totals_trigger') THEN
    CREATE TRIGGER sync_time_totals_trigger
      AFTER INSERT ON public.user_content_sessions
      FOR EACH ROW EXECUTE FUNCTION public.sync_content_item_time_totals();
  END IF;
END $$;

-- sync_content_item_openers: also undocumented, but already correct
-- (already excludes staff/synthetic, already anonymous-safe since it
-- explicitly requires user_id IS NOT NULL before any comparison) —
-- reproduced verbatim here purely to close the same migration-history gap,
-- not to change its behavior.
CREATE OR REPLACE FUNCTION public.sync_content_item_openers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = NEW.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM user_profiles up WHERE up.user_id = NEW.user_id AND up.is_synthetic = true) THEN RETURN NEW; END IF;
  IF NEW.event_type != 'content_click' OR NEW.content_id IS NULL OR NEW.user_id IS NULL THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM analytics_events
    WHERE user_id = NEW.user_id AND content_id = NEW.content_id
      AND event_type = 'content_click' AND id != NEW.id
  ) THEN
    INSERT INTO content_item_openers (content_item_id, opener_count, updated_at)
    VALUES (NEW.content_id, 1, now())
    ON CONFLICT (content_item_id) DO UPDATE SET
      opener_count = content_item_openers.opener_count + 1,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sync_openers_trigger') THEN
    CREATE TRIGGER sync_openers_trigger
      AFTER INSERT ON public.analytics_events
      FOR EACH ROW EXECUTE FUNCTION public.sync_content_item_openers();
  END IF;
END $$;

-- Rebuild both rollups from the actual source tables so the years (or
-- however long) of double-counting is corrected, not just future writes.
TRUNCATE public.content_item_time_totals;
INSERT INTO public.content_item_time_totals (content_item_id, total_session_seconds, engager_count, updated_at)
SELECT
  ucs.content_item_id,
  SUM(ucs.session_seconds),
  COUNT(*) FILTER (WHERE ucs.user_id IS NULL) + COUNT(DISTINCT ucs.user_id) FILTER (WHERE ucs.user_id IS NOT NULL),
  now()
FROM public.user_content_sessions ucs
LEFT JOIN public.user_roles ur ON ur.user_id = ucs.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')
LEFT JOIN public.user_profiles up ON up.user_id = ucs.user_id AND up.is_synthetic = true
WHERE ur.user_id IS NULL AND up.user_id IS NULL
GROUP BY ucs.content_item_id;

TRUNCATE public.content_item_openers;
INSERT INTO public.content_item_openers (content_item_id, opener_count, updated_at)
SELECT
  ae.content_id,
  COUNT(DISTINCT ae.user_id),
  now()
FROM public.analytics_events ae
LEFT JOIN public.user_roles ur ON ur.user_id = ae.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')
LEFT JOIN public.user_profiles up ON up.user_id = ae.user_id AND up.is_synthetic = true
WHERE ae.event_type = 'content_click'
  AND ae.user_id IS NOT NULL
  AND ae.content_id IS NOT NULL
  AND ur.user_id IS NULL
  AND up.user_id IS NULL
GROUP BY ae.content_id;
