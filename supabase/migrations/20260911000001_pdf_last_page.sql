-- Lets PDF viewers resume at the page they left off on, same as video/audio
-- already resume at their furthest playback position. pdf_total_pages is
-- captured alongside it so "left off on page X of Y" can be displayed on the
-- dashboard/category cards without re-downloading and parsing the PDF just
-- to learn its page count.
ALTER TABLE public.user_content_engagement ADD COLUMN IF NOT EXISTS pdf_last_page integer;
ALTER TABLE public.user_content_engagement ADD COLUMN IF NOT EXISTS pdf_total_pages integer;
