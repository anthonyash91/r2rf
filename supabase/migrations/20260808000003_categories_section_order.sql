-- Per-category manual ordering of section labels (content_items.section
-- values, lowercased/trimmed). Stored directly on the category rather than
-- a separate table — unlike content_types, a section has no identity beyond
-- its name within one category, so there's nothing to key a dedicated table
-- on besides (category_id, name), which an array column already expresses.
-- Admins reorder via up/down controls on the category's admin page; any
-- section in use but not yet in this array is appended (alphabetically) at
-- render time rather than being missing.
ALTER TABLE public.categories ADD COLUMN section_order TEXT[] NOT NULL DEFAULT '{}';
