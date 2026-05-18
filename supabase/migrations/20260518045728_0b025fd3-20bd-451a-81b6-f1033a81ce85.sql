CREATE TABLE public.ip_allowlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ip_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ip allowlist"
ON public.ip_allowlist
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_ip_allowlist_updated_at
BEFORE UPDATE ON public.ip_allowlist
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.ip_allowlist (ip_address, label)
VALUES ('74.138.97.209', 'Default')
ON CONFLICT (ip_address) DO NOTHING;