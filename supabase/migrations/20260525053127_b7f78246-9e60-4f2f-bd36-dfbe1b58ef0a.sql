-- 1) Restrict custom_home_pages SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view custom home pages" ON public.custom_home_pages;

CREATE POLICY "Authenticated users can view custom home pages"
ON public.custom_home_pages
FOR SELECT
TO authenticated
USING (true);

-- 2) Move pg_trgm extension out of public schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;