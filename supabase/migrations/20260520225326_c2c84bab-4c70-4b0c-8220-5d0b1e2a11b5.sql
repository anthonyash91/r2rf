
CREATE TABLE public.user_security_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_key text NOT NULL,
  answer_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_key)
);

CREATE INDEX idx_user_security_answers_user ON public.user_security_answers(user_id);

ALTER TABLE public.user_security_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own security answers"
  ON public.user_security_answers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own security answers"
  ON public.user_security_answers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own security answers"
  ON public.user_security_answers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own security answers"
  ON public.user_security_answers FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage security answers"
  ON public.user_security_answers FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER user_security_answers_set_updated_at
  BEFORE UPDATE ON public.user_security_answers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Rate limit reset attempts
CREATE TABLE public.password_reset_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_attempts_ip_time
  ON public.password_reset_attempts(ip_address, created_at DESC);

ALTER TABLE public.password_reset_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read reset attempts"
  ON public.password_reset_attempts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage reset attempts"
  ON public.password_reset_attempts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
