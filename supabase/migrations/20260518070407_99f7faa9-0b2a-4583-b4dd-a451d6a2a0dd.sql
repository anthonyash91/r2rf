CREATE POLICY "Contributors can manage categories"
ON public.categories
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'contributor'))
WITH CHECK (public.has_role(auth.uid(), 'contributor'));

CREATE POLICY "Contributors can manage content"
ON public.content_items
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'contributor'))
WITH CHECK (public.has_role(auth.uid(), 'contributor'));

CREATE POLICY "Contributors can view categories drafts"
ON public.categories
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'contributor'));