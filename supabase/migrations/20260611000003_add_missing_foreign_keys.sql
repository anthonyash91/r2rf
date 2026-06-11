-- Database audit: add missing foreign key constraints (Issues #2, #3, #4).
--
-- All constraints are added with NOT VALID so this migration does not scan
-- existing rows. Orphaned rows from users or content deleted before these
-- constraints existed would cause a plain ADD CONSTRAINT to fail. NOT VALID
-- enforces referential integrity for all future inserts/updates only.
--
-- Each statement is wrapped in a DO block so the migration is idempotent —
-- safe to re-run if it was previously interrupted.
--
-- To validate existing rows after confirming data integrity, run:
--   ALTER TABLE public.user_logins              VALIDATE CONSTRAINT user_logins_user_id_fkey;
--   ALTER TABLE public.user_content_progress    VALIDATE CONSTRAINT user_content_progress_user_id_fkey;
--   ALTER TABLE public.user_content_progress    VALIDATE CONSTRAINT user_content_progress_content_item_id_fkey;
--   ALTER TABLE public.user_content_progress    VALIDATE CONSTRAINT user_content_progress_category_id_fkey;
--   ALTER TABLE public.user_content_seen        VALIDATE CONSTRAINT user_content_seen_user_id_fkey;
--   ALTER TABLE public.user_content_seen        VALIDATE CONSTRAINT user_content_seen_content_item_id_fkey;
--   ALTER TABLE public.user_dismissed_messages  VALIDATE CONSTRAINT user_dismissed_messages_user_id_fkey;
--   ALTER TABLE public.analytics_events         VALIDATE CONSTRAINT analytics_events_user_id_fkey;
--   ALTER TABLE public.content_item_facilities  VALIDATE CONSTRAINT content_item_facilities_facility_value_fkey;
--   ALTER TABLE public.category_facilities      VALIDATE CONSTRAINT category_facilities_facility_value_fkey;

-- ── Issue #2: user_id → auth.users ───────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_logins_user_id_fkey'
      AND conrelid = 'public.user_logins'::regclass
  ) THEN
    ALTER TABLE public.user_logins
      ADD CONSTRAINT user_logins_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_content_progress_user_id_fkey'
      AND conrelid = 'public.user_content_progress'::regclass
  ) THEN
    ALTER TABLE public.user_content_progress
      ADD CONSTRAINT user_content_progress_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_content_seen_user_id_fkey'
      AND conrelid = 'public.user_content_seen'::regclass
  ) THEN
    ALTER TABLE public.user_content_seen
      ADD CONSTRAINT user_content_seen_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_dismissed_messages_user_id_fkey'
      AND conrelid = 'public.user_dismissed_messages'::regclass
  ) THEN
    ALTER TABLE public.user_dismissed_messages
      ADD CONSTRAINT user_dismissed_messages_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

-- analytics_events.user_id: ON DELETE SET NULL — preserve event counts
-- after user deletion rather than removing the historical record.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'analytics_events_user_id_fkey'
      AND conrelid = 'public.analytics_events'::regclass
  ) THEN
    ALTER TABLE public.analytics_events
      ADD CONSTRAINT analytics_events_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- ── Issue #3: content_item_id / category_id → content_items / categories ─────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_content_progress_content_item_id_fkey'
      AND conrelid = 'public.user_content_progress'::regclass
  ) THEN
    ALTER TABLE public.user_content_progress
      ADD CONSTRAINT user_content_progress_content_item_id_fkey
      FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_content_progress_category_id_fkey'
      AND conrelid = 'public.user_content_progress'::regclass
  ) THEN
    ALTER TABLE public.user_content_progress
      ADD CONSTRAINT user_content_progress_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_content_seen_content_item_id_fkey'
      AND conrelid = 'public.user_content_seen'::regclass
  ) THEN
    ALTER TABLE public.user_content_seen
      ADD CONSTRAINT user_content_seen_content_item_id_fkey
      FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

-- ── Issue #4: facility_value → facilities.value ───────────────────────────────
-- facilities.value has a UNIQUE constraint so it can be the target of a FK.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'content_item_facilities_facility_value_fkey'
      AND conrelid = 'public.content_item_facilities'::regclass
  ) THEN
    ALTER TABLE public.content_item_facilities
      ADD CONSTRAINT content_item_facilities_facility_value_fkey
      FOREIGN KEY (facility_value) REFERENCES public.facilities(value) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'category_facilities_facility_value_fkey'
      AND conrelid = 'public.category_facilities'::regclass
  ) THEN
    ALTER TABLE public.category_facilities
      ADD CONSTRAINT category_facilities_facility_value_fkey
      FOREIGN KEY (facility_value) REFERENCES public.facilities(value) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;
