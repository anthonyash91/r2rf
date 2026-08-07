-- Optional section label per chapter (e.g. "Foreword", "Chapters",
-- "Appendices") for grouping a content item's audio chapters into named
-- sections. Purely a display label — chapter order/play sequence is still
-- governed by sort_order; consecutive chapters sharing the same section are
-- grouped under one header in the admin editor and public player. NULL
-- (the default for all existing rows) renders with no header.
ALTER TABLE public.content_chapters ADD COLUMN section TEXT;
ALTER TABLE public.content_chapters ADD COLUMN section_es TEXT;
