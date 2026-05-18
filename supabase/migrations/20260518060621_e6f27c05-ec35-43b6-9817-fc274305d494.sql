CREATE TABLE public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('category_view', 'content_click')),
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  content_id UUID REFERENCES public.content_items(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can read analytics events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_category ON public.analytics_events(category_id);
CREATE INDEX idx_analytics_events_content ON public.analytics_events(content_id);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at DESC);