ALTER TABLE public.facilities ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

INSERT INTO public.facilities (value, label, sort_order, hidden)
VALUES ('test_facility', 'Test Facility', 9999, true)
ON CONFLICT DO NOTHING;