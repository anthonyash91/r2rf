-- Tracks per-chapter audio progress for each user.
-- One row per (user, chapter). furthest_seconds = furthest point the user has
-- reached within that chapter in any session.
-- Progress for a multi-chapter audio item = SUM(furthest_seconds) / total_duration.

CREATE TABLE IF NOT EXISTS user_chapter_progress (
  user_id         UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id      UUID    NOT NULL REFERENCES content_chapters(id) ON DELETE CASCADE,
  content_item_id UUID    NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  furthest_seconds NUMERIC NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_user_chapter_progress_item
  ON user_chapter_progress (user_id, content_item_id);

ALTER TABLE user_chapter_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_chapter_progress"
  ON user_chapter_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_chapter_progress"
  ON user_chapter_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_chapter_progress"
  ON user_chapter_progress FOR UPDATE
  USING (auth.uid() = user_id);
