-- Critical #1 (database audit): Add migrations for tables that were created via
-- the Supabase dashboard and are absent from the migration history.
--
-- Without these migrations a fresh environment (disaster recovery, staging)
-- cannot be set up from the repository alone — the analytics stack and all
-- engagement tracking would be missing.
--
-- Every statement is idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF
-- NOT EXISTS, CREATE OR REPLACE FUNCTION, and DO blocks for policies/triggers.
-- Safe to run against the live database where these tables already exist.
--
-- The unique constraints on analytics_retention, analytics_weekly_growth, and
-- analytics_program_completion are NOT included here — they are added by
-- migration 20260610000008 via ALTER TABLE.

-- ── user_content_engagement ───────────────────────────────────────────────────
-- One row per user per content item (upserted). Tracks cumulative session time,
-- furthest media position, and manual PDF completion %.
-- Written by the client-side use-content-engagement hook.

CREATE TABLE IF NOT EXISTS public.user_content_engagement (
  user_id                  uuid        NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  content_item_id          uuid        NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  category_id              uuid        NOT NULL REFERENCES public.categories(id)    ON DELETE CASCADE,
  session_seconds          integer     NOT NULL DEFAULT 0,
  media_progress_seconds   numeric,
  media_duration_seconds   numeric,
  manual_completion_pct    numeric,
  last_updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_item_id)
);

CREATE INDEX IF NOT EXISTS user_content_engagement_user_idx
  ON public.user_content_engagement (user_id);

ALTER TABLE public.user_content_engagement ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_content_engagement' AND policyname = 'Users manage own engagement') THEN
    CREATE POLICY "Users manage own engagement"
      ON public.user_content_engagement FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_content_engagement' AND policyname = 'Admins manage engagement') THEN
    CREATE POLICY "Admins manage engagement"
      ON public.user_content_engagement FOR ALL TO authenticated
      USING ((SELECT public.has_role(auth.uid(), 'admin')))
      WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));
  END IF;
END $$;

-- ── user_content_sessions ─────────────────────────────────────────────────────
-- One row per session close (INSERT only). Used for date-range analytics.
-- recorded_at defaults to now() and is not sent explicitly by the client.

CREATE TABLE IF NOT EXISTS public.user_content_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  content_item_id uuid        NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  category_id     uuid        NOT NULL REFERENCES public.categories(id)    ON DELETE CASCADE,
  session_seconds integer     NOT NULL DEFAULT 0,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_content_sessions_user_recorded_idx
  ON public.user_content_sessions (user_id, recorded_at DESC);

-- Note: migration 20260610000003 created user_content_sessions_user_category_idx
-- on (user_id, category_id, created_at DESC) — the column name was wrong (created_at
-- does not exist; the column is recorded_at). That migration was corrected in place.
CREATE INDEX IF NOT EXISTS user_content_sessions_user_category_recorded_idx
  ON public.user_content_sessions (user_id, category_id, recorded_at DESC);

ALTER TABLE public.user_content_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_content_sessions' AND policyname = 'Users insert own sessions') THEN
    CREATE POLICY "Users insert own sessions"
      ON public.user_content_sessions FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_content_sessions' AND policyname = 'Users view own sessions') THEN
    CREATE POLICY "Users view own sessions"
      ON public.user_content_sessions FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_content_sessions' AND policyname = 'Admins manage sessions') THEN
    CREATE POLICY "Admins manage sessions"
      ON public.user_content_sessions FOR ALL TO authenticated
      USING ((SELECT public.has_role(auth.uid(), 'admin')))
      WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));
  END IF;
END $$;

-- ── content_item_stats ────────────────────────────────────────────────────────
-- Nightly aggregate per content item. Written only by refresh_analytics_stats()
-- via service_role which bypasses RLS.

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'content_item_stats' AND policyname = 'Admins read content item stats') THEN
    CREATE POLICY "Admins read content item stats"
      ON public.content_item_stats FOR SELECT TO authenticated
      USING ((SELECT public.has_role(auth.uid(), 'admin'))
          OR (SELECT public.has_role(auth.uid(), 'facilityUser')));
  END IF;
END $$;

-- ── facility_stats ────────────────────────────────────────────────────────────

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'facility_stats' AND policyname = 'Admins and facility users read facility stats') THEN
    CREATE POLICY "Admins and facility users read facility stats"
      ON public.facility_stats FOR SELECT TO authenticated
      USING ((SELECT public.has_role(auth.uid(), 'admin'))
          OR (SELECT public.has_role(auth.uid(), 'facilityUser')));
  END IF;
END $$;

-- ── user_stats ────────────────────────────────────────────────────────────────

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_stats' AND policyname = 'Users read own stats') THEN
    CREATE POLICY "Users read own stats"
      ON public.user_stats FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_stats' AND policyname = 'Admins and facility users read user stats') THEN
    CREATE POLICY "Admins and facility users read user stats"
      ON public.user_stats FOR SELECT TO authenticated
      USING ((SELECT public.has_role(auth.uid(), 'admin'))
          OR (SELECT public.has_role(auth.uid(), 'facilityUser')));
  END IF;
END $$;

-- ── content_item_openers ──────────────────────────────────────────────────────
-- Trigger-maintained: incremented on the first content_click from a given user.

CREATE TABLE IF NOT EXISTS public.content_item_openers (
  content_item_id uuid    PRIMARY KEY REFERENCES public.content_items(id) ON DELETE CASCADE,
  opener_count    integer NOT NULL DEFAULT 0
);

ALTER TABLE public.content_item_openers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'content_item_openers' AND policyname = 'Admins and facility users read openers') THEN
    CREATE POLICY "Admins and facility users read openers"
      ON public.content_item_openers FOR SELECT TO authenticated
      USING ((SELECT public.has_role(auth.uid(), 'admin'))
          OR (SELECT public.has_role(auth.uid(), 'facilityUser')));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.increment_content_item_openers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.event_type = 'content_click'
    AND NEW.user_id IS NOT NULL
    AND NEW.content_id IS NOT NULL
  THEN
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_content_item_openers') THEN
    CREATE TRIGGER tr_content_item_openers
      AFTER INSERT ON public.analytics_events
      FOR EACH ROW EXECUTE FUNCTION public.increment_content_item_openers();
  END IF;
END $$;

-- ── content_item_time_totals ──────────────────────────────────────────────────
-- Trigger-maintained: cumulative session time per item for all-time overall view.

CREATE TABLE IF NOT EXISTS public.content_item_time_totals (
  content_item_id       uuid    PRIMARY KEY REFERENCES public.content_items(id) ON DELETE CASCADE,
  total_session_seconds bigint  NOT NULL DEFAULT 0,
  engager_count         integer NOT NULL DEFAULT 0
);

ALTER TABLE public.content_item_time_totals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'content_item_time_totals' AND policyname = 'Admins and facility users read time totals') THEN
    CREATE POLICY "Admins and facility users read time totals"
      ON public.content_item_time_totals FOR SELECT TO authenticated
      USING ((SELECT public.has_role(auth.uid(), 'admin'))
          OR (SELECT public.has_role(auth.uid(), 'facilityUser')));
  END IF;
END $$;

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_content_item_time_totals') THEN
    CREATE TRIGGER tr_content_item_time_totals
      AFTER INSERT ON public.user_content_sessions
      FOR EACH ROW EXECUTE FUNCTION public.increment_content_item_time_totals();
  END IF;
END $$;

-- ── analytics_retention ───────────────────────────────────────────────────────
-- Unique constraint added by migration 20260610000008; not included here.

CREATE TABLE IF NOT EXISTS public.analytics_retention (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_value text,
  day7_rate      numeric,
  day30_rate     numeric,
  day60_rate     numeric,
  total_users    integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_retention ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'analytics_retention' AND policyname = 'Admins and facility users read retention') THEN
    CREATE POLICY "Admins and facility users read retention"
      ON public.analytics_retention FOR SELECT TO authenticated
      USING ((SELECT public.has_role(auth.uid(), 'admin'))
          OR (SELECT public.has_role(auth.uid(), 'facilityUser')));
  END IF;
END $$;

-- ── analytics_weekly_growth ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analytics_weekly_growth (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_value text,
  week_ending    date NOT NULL,
  signups        integer NOT NULL DEFAULT 0,
  active_users   integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_weekly_growth ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'analytics_weekly_growth' AND policyname = 'Admins and facility users read weekly growth') THEN
    CREATE POLICY "Admins and facility users read weekly growth"
      ON public.analytics_weekly_growth FOR SELECT TO authenticated
      USING ((SELECT public.has_role(auth.uid(), 'admin'))
          OR (SELECT public.has_role(auth.uid(), 'facilityUser')));
  END IF;
END $$;

-- ── analytics_program_completion ─────────────────────────────────────────────

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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'analytics_program_completion' AND policyname = 'Admins and facility users read program completion') THEN
    CREATE POLICY "Admins and facility users read program completion"
      ON public.analytics_program_completion FOR SELECT TO authenticated
      USING ((SELECT public.has_role(auth.uid(), 'admin'))
          OR (SELECT public.has_role(auth.uid(), 'facilityUser')));
  END IF;
END $$;
