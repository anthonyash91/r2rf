-- Strip trailing commas and whitespace from facility labels that were
-- bulk-imported from source data containing trailing commas.
-- e.g. "Adams, ID," → "Adams, ID"  |  "Adams, ID , " → "Adams, ID"
UPDATE public.facilities
SET label = regexp_replace(TRIM(label), ',+$', '')
WHERE TRIM(label) ~ ',+$';
