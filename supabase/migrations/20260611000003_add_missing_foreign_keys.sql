-- Database audit: add missing foreign key constraints (Issues #2, #3, #4).
--
-- All constraints use NOT VALID so this migration does not scan existing rows.
-- Orphaned rows from users or content deleted before these constraints existed
-- would cause a plain ADD CONSTRAINT to fail. NOT VALID enforces referential
-- integrity for all future inserts/updates without blocking on historical data.
--
-- To validate existing rows after confirming data integrity:
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

-- user_logins: orphaned login records on user delete. ON DELETE CASCADE so
-- login history is removed when the user is removed.
ALTER TABLE public.user_logins
  ADD CONSTRAINT user_logins_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  NOT VALID;

-- user_content_progress: ON DELETE CASCADE — a user's completion records
-- should not outlive the user.
ALTER TABLE public.user_content_progress
  ADD CONSTRAINT user_content_progress_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  NOT VALID;

-- user_content_seen: same reasoning.
ALTER TABLE public.user_content_seen
  ADD CONSTRAINT user_content_seen_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  NOT VALID;

-- user_dismissed_messages: same reasoning.
ALTER TABLE public.user_dismissed_messages
  ADD CONSTRAINT user_dismissed_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
  NOT VALID;

-- analytics_events: ON DELETE SET NULL rather than CASCADE — anonymous events
-- (user_id already NULL) and pre-aggregated daily counts are still valid even
-- after the originating user is deleted. We preserve the event counts.
ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
  NOT VALID;

-- ── Issue #3: content_item_id / category_id → content_items / categories ─────

-- user_content_progress: deleting a content item should remove all completion
-- records for that item (orphaned progress is meaningless and wastes space).
ALTER TABLE public.user_content_progress
  ADD CONSTRAINT user_content_progress_content_item_id_fkey
  FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE
  NOT VALID;

-- user_content_progress: category_id denormalization — cascade on category
-- delete so stale category references are cleaned up automatically.
ALTER TABLE public.user_content_progress
  ADD CONSTRAINT user_content_progress_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE
  NOT VALID;

-- user_content_seen: same reasoning as user_content_progress.
ALTER TABLE public.user_content_seen
  ADD CONSTRAINT user_content_seen_content_item_id_fkey
  FOREIGN KEY (content_item_id) REFERENCES public.content_items(id) ON DELETE CASCADE
  NOT VALID;

-- ── Issue #4: facility_value → facilities.value ───────────────────────────────
-- facilities.value has a UNIQUE constraint so it can be the target of a FK.
-- ON DELETE CASCADE: removing a facility should remove its content/category
-- restrictions, not leave items permanently restricted to a ghost facility.

ALTER TABLE public.content_item_facilities
  ADD CONSTRAINT content_item_facilities_facility_value_fkey
  FOREIGN KEY (facility_value) REFERENCES public.facilities(value) ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.category_facilities
  ADD CONSTRAINT category_facilities_facility_value_fkey
  FOREIGN KEY (facility_value) REFERENCES public.facilities(value) ON DELETE CASCADE
  NOT VALID;
