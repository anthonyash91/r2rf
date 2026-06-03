-- Replace hardcoded CONTENT_TYPES array with a database table so all types
-- are fully editable — admins and contributors can add or delete any type.
CREATE TABLE public.content_types (
  value      text    PRIMARY KEY,
  sort_order integer NOT NULL DEFAULT 100
);

-- Seed built-in types with explicit ordering
INSERT INTO public.content_types (value, sort_order) VALUES
  ('Article',   1),
  ('Audio',     2),
  ('Guide',     3),
  ('Image',     4),
  ('Link',      5),
  ('PDF',       6),
  ('Podcast',   7),
  ('Resource',  8),
  ('Video',     9),
  ('Worksheet', 10)
ON CONFLICT (value) DO NOTHING;

-- Pull in any custom types already used on existing content items so nothing
-- gets orphaned after this migration.
INSERT INTO public.content_types (value, sort_order)
SELECT DISTINCT type, 100
FROM public.content_items
WHERE type IS NOT NULL AND type <> ''
ON CONFLICT (value) DO NOTHING;

-- RLS: everyone authenticated can read, admin/contributor can write
ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read content_types"
  ON public.content_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins and contributors can write content_types"
  ON public.content_types FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'contributor')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'contributor')
  );

-- Update the reassign function to also delete the old type from content_types
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
  DELETE FROM public.content_types WHERE value = old_type;
  RETURN updated_count;
END;
$$;
