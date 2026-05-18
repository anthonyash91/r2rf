
-- Custom home pages
CREATE TABLE public.custom_home_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_custom_home_pages_updated_at
BEFORE UPDATE ON public.custom_home_pages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.custom_home_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view custom home pages"
ON public.custom_home_pages FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can manage custom home pages"
ON public.custom_home_pages FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Join table for category selection
CREATE TABLE public.custom_home_page_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_home_page_id uuid NOT NULL REFERENCES public.custom_home_pages(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (custom_home_page_id, category_id)
);

CREATE INDEX idx_chpc_home ON public.custom_home_page_categories(custom_home_page_id);

ALTER TABLE public.custom_home_page_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view custom home page categories"
ON public.custom_home_page_categories FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Admins can manage custom home page categories"
ON public.custom_home_page_categories FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
