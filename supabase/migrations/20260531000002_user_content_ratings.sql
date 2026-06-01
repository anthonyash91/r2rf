-- Stores each user's thumbs-up (1) or thumbs-down (-1) rating per item.
CREATE TABLE user_content_ratings (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating IN (1, -1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_item_id)
);

ALTER TABLE user_content_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can manage own ratings"
  ON user_content_ratings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger-maintained aggregate so we never COUNT(*) on every page load.
CREATE TABLE content_item_rating_totals (
  content_item_id uuid PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
  thumbs_up integer NOT NULL DEFAULT 0,
  thumbs_down integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE content_item_rating_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read rating totals"
  ON content_item_rating_totals FOR SELECT USING (true);

-- Trigger function that keeps totals in sync.
CREATE OR REPLACE FUNCTION update_rating_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO content_item_rating_totals (content_item_id, thumbs_up, thumbs_down)
    VALUES (
      NEW.content_item_id,
      CASE WHEN NEW.rating = 1 THEN 1 ELSE 0 END,
      CASE WHEN NEW.rating = -1 THEN 1 ELSE 0 END
    )
    ON CONFLICT (content_item_id) DO UPDATE SET
      thumbs_up   = content_item_rating_totals.thumbs_up   + CASE WHEN NEW.rating = 1  THEN 1 ELSE 0 END,
      thumbs_down = content_item_rating_totals.thumbs_down + CASE WHEN NEW.rating = -1 THEN 1 ELSE 0 END,
      updated_at  = now();

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content_item_rating_totals SET
      thumbs_up   = GREATEST(0, thumbs_up   - CASE WHEN OLD.rating = 1  THEN 1 ELSE 0 END),
      thumbs_down = GREATEST(0, thumbs_down - CASE WHEN OLD.rating = -1 THEN 1 ELSE 0 END),
      updated_at  = now()
    WHERE content_item_id = OLD.content_item_id;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE content_item_rating_totals SET
      thumbs_up   = GREATEST(0, thumbs_up
        + CASE WHEN NEW.rating = 1  THEN 1 ELSE 0 END
        - CASE WHEN OLD.rating = 1  THEN 1 ELSE 0 END),
      thumbs_down = GREATEST(0, thumbs_down
        + CASE WHEN NEW.rating = -1 THEN 1 ELSE 0 END
        - CASE WHEN OLD.rating = -1 THEN 1 ELSE 0 END),
      updated_at  = now()
    WHERE content_item_id = NEW.content_item_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER tr_rating_totals
AFTER INSERT OR UPDATE OR DELETE ON user_content_ratings
FOR EACH ROW EXECUTE FUNCTION update_rating_totals();
