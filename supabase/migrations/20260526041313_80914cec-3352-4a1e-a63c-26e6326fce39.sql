-- Revoke column-level SELECT on allowed_ips from anon and authenticated.
-- The broad row-level policy stays (the app needs to read id/slug/name for routing),
-- but the sensitive IP allowlist column is now hidden from PostgREST for non-admin reads.
-- Server code reading allowed_ips uses the service_role client, which bypasses these grants.
REVOKE SELECT (allowed_ips) ON public.custom_home_pages FROM anon, authenticated;

COMMENT ON COLUMN public.custom_home_pages.allowed_ips IS
  'Sensitive: list of IPs allowed to access this custom home page. Column-level SELECT revoked from anon/authenticated; only service_role may read.';