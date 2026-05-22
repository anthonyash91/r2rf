
CREATE TABLE IF NOT EXISTS public.user_content_seen (
  user_id UUID NOT NULL,
  content_item_id UUID NOT NULL,
  seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_item_id)
);

ALTER TABLE public.user_content_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own seen records"
ON public.user_content_seen FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own seen records"
ON public.user_content_seen FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_content_seen_user ON public.user_content_seen(user_id);

INSERT INTO public.user_content_seen (user_id, content_item_id, seen_at)
SELECT user_id, content_item_id, COALESCE(created_at, now())
FROM public.user_content_progress
ON CONFLICT DO NOTHING;
