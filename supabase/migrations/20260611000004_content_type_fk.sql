-- Issue #5 (database audit): add FK from content_items.type to content_types.value.
--
-- content_types was added as a proper table (migration 20260602000005) but
-- content_items.type remained a plain TEXT column with no referential constraint.
-- Deleting a custom content type via the Supabase dashboard would leave
-- content_items with a dangling text value — the app still renders them but
-- they display with a missing badge.
--
-- ON UPDATE CASCADE: if a type's label is changed, all items are updated.
-- ON DELETE SET DEFAULT: if a type is deleted, items fall back to 'Article',
-- matching the existing reassign_content_type() application behaviour.
--
-- The content_types table was backfilled from content_items at creation time,
-- so all existing type values should already be present. Run the diagnostic
-- below first to confirm — if any orphaned types exist, insert them into
-- content_types before applying this migration:
--
--   SELECT DISTINCT type FROM public.content_items
--   WHERE type IS NOT NULL AND type NOT IN (SELECT value FROM public.content_types);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'content_items_type_fkey'
      AND conrelid = 'public.content_items'::regclass
  ) THEN
    ALTER TABLE public.content_items
      ADD CONSTRAINT content_items_type_fkey
      FOREIGN KEY (type) REFERENCES public.content_types(value)
      ON UPDATE CASCADE
      ON DELETE SET DEFAULT
      NOT VALID;
  END IF;
END $$;

-- Validate immediately — content_types was backfilled from content_items so
-- there should be no orphaned values.
ALTER TABLE public.content_items VALIDATE CONSTRAINT content_items_type_fkey;
