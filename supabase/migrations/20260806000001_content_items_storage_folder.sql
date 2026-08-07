-- Persists the Bunny storage folder chosen for a content item's uploaded
-- files (uploads/{category-slug}/{item-folder}/...). Computed once client-side
-- from the item's title + id at first upload and stored here so later
-- uploads (a replaced file, added chapters) land in the same folder even if
-- the item's title is edited afterward — title alone isn't stable enough to
-- rederive the folder on every upload.
-- Nullable: items created before this feature simply have no folder and
-- their existing files are left in place (not reorganized).
ALTER TABLE public.content_items ADD COLUMN storage_folder TEXT;
