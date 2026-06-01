-- The trigger function must run as the table owner so it can INSERT/UPDATE
-- content_item_rating_totals regardless of the calling user's RLS context.
CREATE OR REPLACE FUNCTION update_rating_totals()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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
