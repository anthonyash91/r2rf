
CREATE TABLE public.facilities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view facilities"
  ON public.facilities FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage facilities"
  ON public.facilities FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_facilities_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.facilities (value, label, sort_order) VALUES
  ('pennington_sd', 'Pennington, SD', 0),
  ('campbell_ky', 'Campbell, KY', 1);
