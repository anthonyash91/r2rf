CREATE TABLE public.user_dismissed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message_kind text NOT NULL,
  dismissed_version timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_kind)
);

ALTER TABLE public.user_dismissed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dismissals"
  ON public.user_dismissed_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own dismissals"
  ON public.user_dismissed_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own dismissals"
  ON public.user_dismissed_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own dismissals"
  ON public.user_dismissed_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage dismissals"
  ON public.user_dismissed_messages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_user_dismissed_messages_updated_at
  BEFORE UPDATE ON public.user_dismissed_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();