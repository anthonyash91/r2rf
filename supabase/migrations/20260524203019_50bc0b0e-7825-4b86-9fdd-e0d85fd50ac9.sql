
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS analytics_events_user_id_idx ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events(created_at);

DROP POLICY IF EXISTS "Anyone can record analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can record analytics events"
  ON public.analytics_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_type = ANY (ARRAY['category_view'::text, 'content_click'::text])
    AND (user_id IS NULL OR user_id = auth.uid())
  );
