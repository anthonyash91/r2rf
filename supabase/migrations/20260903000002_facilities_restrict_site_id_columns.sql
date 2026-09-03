-- RLS on facilities is deliberately permissive at the ROW level (every
-- visitor should see every non-hidden facility's name/slug for the site
-- picker) — but RLS only governs rows, not columns. site_id_hmac and
-- site_id_encrypted exist specifically to keep a facility's real device
-- Site ID out of the database in plaintext, and the app already treats them
-- as server-only (never returned to public callers — see listFacilities in
-- src/lib/facilities.functions.ts), but nothing at the database level
-- actually enforced that: anyone with the public anon key could select those
-- two columns directly via the REST API, bypassing the app entirely.
--
-- Column-level GRANT/REVOKE is Postgres's mechanism for exactly this. Every
-- current read of these two columns already goes through the service-role
-- client (which bypasses RLS and grants alike), so this has no effect on
-- existing app functionality — it just closes the direct-API gap.
REVOKE SELECT ON public.facilities FROM anon, authenticated;

GRANT SELECT (id, value, label, sort_order, custom_slug, hidden, created_at, updated_at)
  ON public.facilities
  TO anon, authenticated;
