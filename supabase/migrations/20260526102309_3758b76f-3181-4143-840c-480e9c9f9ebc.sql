
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('server', 'client')),
  level text NOT NULL DEFAULT 'error' CHECK (level IN ('error', 'warning', 'info')),
  message text NOT NULL,
  stack text,
  route text,
  user_id uuid,
  user_agent text,
  ip_address text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX error_logs_created_idx ON public.error_logs (created_at DESC);
CREATE INDEX error_logs_source_created_idx ON public.error_logs (source, created_at DESC);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage error logs"
  ON public.error_logs
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
