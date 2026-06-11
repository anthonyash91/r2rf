-- Critical #1 (database audit): Add migrations for tables that were created via
-- the Supabase dashboard and are absent from the migration history.
--
-- Without these migrations, a fresh environment (disaster recovery, staging)
-- cannot be set up from the repository alone — the analytics stack and all
-- engagement tracking would be missing.
--
-- All statements use CREATE TABLE IF NOT EXISTS so this migration is safe to
-- run against the live database where these tables already exist.
-- The unique constraints on analytics_retention, analytics_weekly_growth, and
-- analytics_program_completion are NOT included here — they are added by
-- migration 20260610000008_analytics_upsert_no_zero_window.sql via ALTER TABLE.

-- ── Engagement tracking ───────────────────────────────────────────────────────

-- One row per user per content item (upserted).
-- Tracks cumulative session time, furthest media position, and manual PDF %.
-- Written by the client-side use-content-engagement hook via the public client.
CREATE TABLE IF NOT EXISTS public.user_content_engagement (
  user_id            uuid        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  content_item_id    uuid        NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  category_id        uuid        NOT NULL REFERENCES public.categories(id)   ON DELETE CASCADE,
  session_seconds    integer     NOT NULL DEFAULT 0,
  media_progress_seconds   numeric,
  media_duration_seconds   numeric,
  manual_completion_pct    numeric,
  last_updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_item_id)
);

CREATE INDEX IF NOT EXISTS user_content_engagement_user_idx
  ON public.user_content_engagement (user_id);

ALTER TABLE public.user_content_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own engagement"
  ON public.user_content_engagement FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage engagement"
  ON public.user_content_engagement FOR ALL
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- One row per session close (INSERT only, never upserted).
-- Used for date-range-filterable analytics (unlike user_content_engagement which
-- only has the latest cumulative total, not individual session history).
-- Written by the client-side hook; recorded_at defaults to now().
CREATE TABLE IF NOT EXISTS public.user_content_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id)         ON DELETE CASCADE,
  content_item_id uuid        NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  category_id     uuid        NOT NULL REFERENCES public.categories(id)   ON DELETE CASCADE,
  session_seconds integer     NOT NULL DEFAULT 0,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

-- Note: migration 20260610000003 created user_content_sessions_user_category_idx
-- on (user_id, category_id, created_at DESC) — this was a bug; the column is
-- recorded_at. The correct indexes are below and in 20260601000005.
CREATE INDEX IF NOT EXISTS user_content_sessions_user_recorded_idx
  ON public.user_content_sessions (user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS user_content_sessions_user_category_recorded_idx
  ON public.user_content_sessions (user_id, category_id, recorded_at DESC);

ALTER TABLE public.user_content_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own sessions"
  ON public.user_content_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own sessions"
  ON public.user_content_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage sessions"
  ON public.user_content_sessions FOR ALL
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── Nightly aggregate tables (populated by refresh_analytics_stats) ──────────
-- These are written only by the nightly job via supabaseAdmin (service_role),
-- which bypasses RLS. RLS is still enabled as defense-in-depth.

CREATE TABLE IF NOT EXISTS public.content_item_stats (
  content_item_id        uuid    PRIMARY KEY REFERENCES public.content_items(id) ON DELETE CASCADE,
  open_count             integer NOT NULL DEFAULT 0,
  complete_count         integer NOT NULL DEFAULT 0,
  completion_rate        numeric NOT NULL DEFAULT 0,
  avg_session_seconds    numeric,
  avg_media_progress_pct numeric,
  drop_off_count         integer NOT NULL DEFAULT 0,
  total_session_seconds  bigint  NOT NULL DEFAULT 0,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_item_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read content item stats"
  ON public.content_item_stats FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'))
      OR (SELECT public.has_role(auth.uid(), 'facilityUser')));

-- ──

CREATE TABLE IF NOT EXISTS public.facility_stats (
  facility_value        text    PRIMARY KEY,
  active_users_7d       integer NOT NULL DEFAULT 0,
  active_users_30d      integer NOT NULL DEFAULT 0,
  total_users           integer NOT NULL DEFAULT 0,
  avg_completion_rate   numeric,
  total_session_seconds bigint  NOT NULL DEFAULT 0,
  items_completed_total integer NOT NULL DEFAULT 0,
  bookmark_count        integer NOT NULL DEFAULT 0,
  thumbs_up_count       integer NOT NULL DEFAULT 0,
  thumbs_down_count     integer NOT NULL DEFAULT 0,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facility_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and facility users read facility stats"
  ON public.facility_stats FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'))
      OR (SELECT public.has_role(auth.uid(), 'facilityUser')));

-- ──

CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id               uuid    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_value        text,
  items_completed       integer NOT NULL DEFAULT 0,
  items_started         integer NOT NULL DEFAULT 0,
  total_session_seconds bigint  NOT NULL DEFAULT 0,
  facility_percentile   numeric,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own stats"
  ON public.user_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins and facility users read user stats"
  ON public.user_stats FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'))
      OR (SELECT public.has_role(auth.uid(), 'facilityUser')));

-- ── Trigger-maintained totals (updated on analytics_events / sessions INSERT) ─

-- Unique openers per content item: incremented the first time a non-staff
-- user clicks a content item (checked via analytics_events history lookup).
CREATE TABLE IF NOT EXISTS public.content_item_openers (
  content_item_id uuid    PRIMARY KEY REFERENCES public.content_items(id) ON DELETE CASCADE,
  opener_count    integer NOT NULL DEFAULT 0
);

ALTER TABLE public.content_item_openers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and facility users read openers"
  ON public.content_item_openers FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'))
      OR (SELECT public.has_role(auth.uid(), 'facilityUser')));

-- Trigger: increment opener_count on first content_click from a given user.
CREATE OR REPLACE FUNCTION public.increment_content_item_openers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.event_type = 'content_click'
    AND NEW.user_id IS NOT NULL
    AND NEW.content_id IS NOT NULL
  THEN
    -- Only count if this is the first click from this user on this item.
    -- The composite index analytics_events_opener_check_idx makes this fast.
    IF NOT EXISTS (
      SELECT 1 FROM public.analytics_events
      WHERE user_id    = NEW.user_id
        AND content_id = NEW.content_id
        AND event_type = 'content_click'
        AND id        != NEW.id
    ) THEN
      INSERT INTO public.content_item_openers (content_item_id, opener_count)
      VALUES (NEW.content_id, 1)
      ON CONFLICT (content_item_id)
      DO UPDATE SET opener_count = public.content_item_openers.opener_count + 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_content_item_openers
  AFTER INSERT ON public.analytics_events
  FOR EACH ROW EXECUTE FUNCTION public.increment_content_item_openers();

-- ──

-- Cumulative time and session count per content item.
-- engager_count is the number of sessions, used to derive average time per session.
CREATE TABLE IF NOT EXISTS public.content_item_time_totals (
  content_item_id       uuid   PRIMARY KEY REFERENCES public.content_items(id) ON DELETE CASCADE,
  total_session_seconds bigint NOT NULL DEFAULT 0,
  engager_count         integer NOT NULL DEFAULT 0
);

ALTER TABLE public.content_item_time_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and facility users read time totals"
  ON public.content_item_time_totals FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'))
      OR (SELECT public.has_role(auth.uid(), 'facilityUser')));

-- Trigger: accumulate session time on every user_content_sessions INSERT.
CREATE OR REPLACE FUNCTION public.increment_content_item_time_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.content_item_time_totals (content_item_id, total_session_seconds, engager_count)
  VALUES (NEW.content_item_id, NEW.session_seconds, 1)
  ON CONFLICT (content_item_id)
  DO UPDATE SET
    total_session_seconds = public.content_item_time_totals.total_session_seconds + NEW.session_seconds,
    engager_count         = public.content_item_time_totals.engager_count + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_content_item_time_totals
  AFTER INSERT ON public.user_content_sessions
  FOR EACH ROW EXECUTE FUNCTION public.increment_content_item_time_totals();

-- ── Nightly retention / growth / completion tables ───────────────────────────
-- Unique constraints are added by migration 20260610000008; not included here
-- so this migration and 20260610000008 can both run cleanly in any order.

CREATE TABLE IF NOT EXISTS public.analytics_retention (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_value text,  -- NULL = overall aggregate across all facilities
  day7_rate    numeric,
  day30_rate   numeric,
  day60_rate   numeric,
  total_users  integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_retention ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and facility users read retention"
  ON public.analytics_retention FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'))
      OR (SELECT public.has_role(auth.uid(), 'facilityUser')));

-- ──

CREATE TABLE IF NOT EXISTS public.analytics_weekly_growth (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_value text,
  week_ending  date NOT NULL,
  signups      integer NOT NULL DEFAULT 0,
  active_users integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_weekly_growth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and facility users read weekly growth"
  ON public.analytics_weekly_growth FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'))
      OR (SELECT public.has_role(auth.uid(), 'facilityUser')));

-- ──

CREATE TABLE IF NOT EXISTS public.analytics_program_completion (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid    NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  facility_value  text,
  name            text    NOT NULL DEFAULT '',
  total_items     integer NOT NULL DEFAULT 0,
  users_engaged   integer NOT NULL DEFAULT 0,
  users_completed integer NOT NULL DEFAULT 0,
  completion_rate numeric,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_program_completion_category_idx
  ON public.analytics_program_completion (category_id);

ALTER TABLE public.analytics_program_completion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and facility users read program completion"
  ON public.analytics_program_completion FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'))
      OR (SELECT public.has_role(auth.uid(), 'facilityUser')));
