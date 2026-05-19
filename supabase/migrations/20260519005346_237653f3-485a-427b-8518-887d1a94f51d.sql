ALTER TABLE public.categories
  ADD COLUMN home_page_mode text NOT NULL DEFAULT 'default'
  CHECK (home_page_mode IN ('default', 'custom'));

UPDATE public.categories SET home_page_mode = 'default' WHERE home_page_mode IS NULL;