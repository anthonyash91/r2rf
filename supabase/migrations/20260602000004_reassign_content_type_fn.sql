-- SECURITY DEFINER function to reassign all content items of a given type
-- to "Article". Called from the admin content editor when a custom type is
-- deleted. Runs as the function owner (bypasses RLS entirely).
CREATE OR REPLACE FUNCTION public.reassign_content_type(old_type text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.content_items
  SET type = 'Article'
  WHERE type = old_type;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
