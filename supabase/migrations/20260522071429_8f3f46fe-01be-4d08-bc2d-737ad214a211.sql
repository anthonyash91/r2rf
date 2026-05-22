
-- 1) user_profiles: allow users to insert their own row
CREATE POLICY "Users insert own profile"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2) Hide custom_home_pages.allowed_ips from anon
REVOKE SELECT (allowed_ips) ON public.custom_home_pages FROM anon;

-- 3) Remove public listing on category-icons bucket.
-- Files remain accessible via their public URL because the bucket is public.
DROP POLICY IF EXISTS "Public read category-icons" ON storage.objects;

-- 4) Constrain anonymous analytics inserts
DROP POLICY IF EXISTS "Anyone can record analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can record analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IN ('category_view', 'content_click')
);
