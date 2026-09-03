-- content_chapters was created with a SELECT policy scoped to `authenticated`
-- only, unlike content_items (anon + authenticated, gated on published
-- visibility). This app supports anonymous/public content browsing, so any
-- visitor without a Supabase session could never see a chapter list —
-- the audio player silently fell back to treating the item as a single file.
-- Replace it with the same anon+authenticated, published-visibility rule
-- content_items itself uses, scoped through the parent item/category.
DROP POLICY IF EXISTS "Authenticated users can read chapters" ON content_chapters;

CREATE POLICY "Anyone can view chapters for visible content"
  ON content_chapters FOR SELECT
  TO anon, authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'))
    OR EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.categories c ON c.id = ci.category_id
      WHERE ci.id = content_chapters.content_item_id
        AND ci.published = true
        AND c.published = true
    )
  );
