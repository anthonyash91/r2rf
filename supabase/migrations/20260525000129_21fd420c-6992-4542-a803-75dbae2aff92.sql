DROP POLICY IF EXISTS category_icons_public_read ON storage.objects;

CREATE POLICY "category_icons_authenticated_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'category-icons');