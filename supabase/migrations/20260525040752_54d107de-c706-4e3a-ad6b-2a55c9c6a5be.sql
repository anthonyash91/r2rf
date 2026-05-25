-- Restrict the allowed_ips column on custom_home_pages so anonymous visitors
-- can no longer read the IP whitelist via the public RLS SELECT policy.
-- The server's IP enforcement uses the service role key (bypasses RLS and
-- column grants), so this does not affect the firewall.
REVOKE SELECT ON public.custom_home_pages FROM anon;
GRANT SELECT (id, slug, name, description, created_at, updated_at)
  ON public.custom_home_pages TO anon;