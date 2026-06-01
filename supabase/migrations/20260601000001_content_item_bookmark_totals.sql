CREATE TABLE content_item_bookmark_totals (
  content_item_id uuid PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
  bookmark_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE content_item_bookmark_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read bookmark totals"
  ON content_item_bookmark_totals FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION update_bookmark_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO content_item_bookmark_totals (content_item_id, bookmark_count)
    VALUES (NEW.content_item_id, 1)
    ON CONFLICT (content_item_id) DO UPDATE SET
      bookmark_count = content_item_bookmark_totals.bookmark_count + 1,
      updated_at = now();
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content_item_bookmark_totals SET
      bookmark_count = GREATEST(0, bookmark_count - 1),
      updated_at = now()
    WHERE content_item_id = OLD.content_item_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tr_bookmark_totals
AFTER INSERT OR DELETE ON user_content_bookmarks
FOR EACH ROW EXECUTE FUNCTION update_bookmark_totals();
