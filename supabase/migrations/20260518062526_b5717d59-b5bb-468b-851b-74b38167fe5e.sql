CREATE TABLE public.auth_ip_allowlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_ip_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage auth ip allowlist"
ON public.auth_ip_allowlist
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_auth_ip_allowlist_updated_at
BEFORE UPDATE ON public.auth_ip_allowlist
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();