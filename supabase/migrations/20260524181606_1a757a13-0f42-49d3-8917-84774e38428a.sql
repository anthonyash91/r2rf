
-- 1. Revoke read access to the sensitive allowed_ips column from anonymous visitors.
REVOKE SELECT (allowed_ips) ON public.custom_home_pages FROM anon;

-- 2. Storage RLS policies for the category-icons bucket.
-- Public reads remain (bucket is public). Restrict writes to admin/contributor.
DROP POLICY IF EXISTS "category_icons_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "category_icons_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "category_icons_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "category_icons_public_read" ON storage.objects;

CREATE POLICY "category_icons_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'category-icons');

CREATE POLICY "category_icons_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'category-icons'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'contributor'::public.app_role))
);

CREATE POLICY "category_icons_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'category-icons'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'contributor'::public.app_role))
)
WITH CHECK (
  bucket_id = 'category-icons'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'contributor'::public.app_role))
);

CREATE POLICY "category_icons_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'category-icons'
  AND (public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'contributor'::public.app_role))
);
