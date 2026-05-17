
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS name_es text,
  ADD COLUMN IF NOT EXISTS tagline_es text,
  ADD COLUMN IF NOT EXISTS description_es text;

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS source_es text,
  ADD COLUMN IF NOT EXISTS file_url_es text,
  ADD COLUMN IF NOT EXISTS file_name_es text;
