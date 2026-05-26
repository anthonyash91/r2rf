
-- 1) site_settings: hide sensitive operational keys from anon/authenticated.
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;

CREATE POLICY "Anyone can view non-sensitive site settings"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (key NOT IN ('ip_restriction_enabled'));

-- Admins keep full access via the existing "Admins can manage site settings" policy.

-- 2) custom_home_pages.allowed_ips: belt-and-suspenders column privilege revoke.
-- RLS allows authenticated users to SELECT the row (needed for slug/name lookups),
-- but the allowed_ips column must never be exposed. Revoking the column GRANT
-- enforces this at the privilege layer regardless of policy changes.
REVOKE SELECT (allowed_ips) ON public.custom_home_pages FROM anon, authenticated;

COMMENT ON COLUMN public.custom_home_pages.allowed_ips IS
  'Internal IP allowlist. SELECT revoked from anon/authenticated; only service_role (admin server code) may read.';
