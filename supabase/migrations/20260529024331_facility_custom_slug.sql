-- Add optional custom slug to facilities.
-- Visiting /facility/<custom_slug> works identically to /facility/<value>.
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS custom_slug text;
CREATE UNIQUE INDEX IF NOT EXISTS facilities_custom_slug_unique ON facilities (custom_slug) WHERE custom_slug IS NOT NULL;
