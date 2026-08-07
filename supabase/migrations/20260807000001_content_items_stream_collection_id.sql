-- Persists the Bunny Stream collection id created for a content item's
-- video/audio uploads, grouping the item's main file + all its chapters
-- under one collection in the Bunny dashboard. Computed once via a live API
-- call at the item's first Stream upload and cached here so later uploads
-- (a replaced file, an added chapter) land in the same collection instead
-- of each creating a new one.
-- Nullable: items with no Stream video yet, or whose media stays on Bunny
-- Storage (PDFs/images), simply have none.
ALTER TABLE public.content_items ADD COLUMN stream_collection_id TEXT;
