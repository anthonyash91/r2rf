-- 1) Hide allowed_ips column from non-admin clients via column privileges.
--    RLS still permits row access, but PostgREST will refuse column selection.
REVOKE SELECT (allowed_ips) ON public.custom_home_pages FROM anon, authenticated;

-- 2) Restrict custom_home_page_categories SELECT to authenticated users only.
DROP POLICY IF EXISTS "Anyone can view custom home page categories" ON public.custom_home_page_categories;

CREATE POLICY "Authenticated users can view custom home page categories"
ON public.custom_home_page_categories
FOR SELECT
TO authenticated
USING (true);
