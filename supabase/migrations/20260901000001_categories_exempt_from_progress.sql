-- Category-level "exempt from tracking". Not a live-inherited flag — turning
-- it on bulk-sets every current item in the category to exempt (one-time,
-- app-side) and becomes the default for new items created in the category
-- going forward. Turning it off does not auto-revert existing items.
ALTER TABLE public.categories ADD COLUMN exempt_from_progress BOOLEAN NOT NULL DEFAULT FALSE;
