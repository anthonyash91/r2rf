-- Stores ordered audio chapters for a content item.
-- When a content item has one or more rows here, the audio player
-- renders them as a chapter list instead of a single file.
CREATE TABLE content_chapters (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id  UUID        NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  title_es         TEXT,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  file_url         TEXT,
  file_name        TEXT,
  file_url_es      TEXT,
  file_name_es     TEXT,
  duration_seconds NUMERIC,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_chapters_content_item_id ON content_chapters(content_item_id);

ALTER TABLE content_chapters ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read chapters
CREATE POLICY "Authenticated users can read chapters"
  ON content_chapters FOR SELECT
  TO authenticated
  USING (true);

-- Admins and contributors can insert/update/delete chapters
CREATE POLICY "Admins can insert chapters"
  ON content_chapters FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'contributor')
    )
  );

CREATE POLICY "Admins can update chapters"
  ON content_chapters FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'contributor')
    )
  );

CREATE POLICY "Admins can delete chapters"
  ON content_chapters FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'contributor')
    )
  );
