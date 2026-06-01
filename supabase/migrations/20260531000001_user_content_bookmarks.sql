CREATE TABLE user_content_bookmarks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, content_item_id)
);

ALTER TABLE user_content_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own bookmarks"
  ON user_content_bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
