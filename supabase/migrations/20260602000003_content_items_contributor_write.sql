-- The content_items write policy only allowed admin role, but contributors
-- are content editors who need to create, update, and delete content items.
-- This adds a second policy granting contributors the same write access.
-- The original admin-only policy remains unchanged.
CREATE POLICY "contributors can write content_items"
  ON public.content_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'contributor'))
  WITH CHECK (public.has_role(auth.uid(), 'contributor'));
