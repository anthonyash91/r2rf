CREATE TABLE public.ip_passkey_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL UNIQUE,
  failed_count integer NOT NULL DEFAULT 0,
  blocked_at timestamp with time zone,
  last_attempt_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ip_passkey_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage passkey attempts"
ON public.ip_passkey_attempts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_ip_passkey_attempts_updated_at
BEFORE UPDATE ON public.ip_passkey_attempts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_ip_passkey_attempts_blocked_at ON public.ip_passkey_attempts(blocked_at) WHERE blocked_at IS NOT NULL;