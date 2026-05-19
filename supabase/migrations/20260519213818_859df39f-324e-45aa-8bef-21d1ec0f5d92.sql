CREATE TABLE public.user_signup_ips (
  user_id uuid PRIMARY KEY,
  ip_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_signup_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read signup ips"
ON public.user_signup_ips
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage signup ips"
ON public.user_signup_ips
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
