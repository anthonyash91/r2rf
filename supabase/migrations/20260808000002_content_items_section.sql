-- Independent per-item section label (e.g. "eBooks", "Audiobooks") for
-- grouping category-page items into sections. Deliberately unrelated to
-- `type` — two items of the same type can be assigned different sections,
-- and vice versa. NULL (the default for all existing rows) falls into an
-- "uncategorized" bucket on the category page rather than being hidden.
ALTER TABLE public.content_items ADD COLUMN section TEXT;
ALTER TABLE public.content_items ADD COLUMN section_es TEXT;
