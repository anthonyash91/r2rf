INSERT INTO public.custom_home_page_categories (custom_home_page_id, category_id, sort_order)
SELECT
  chp.id,
  c.id,
  c.sort_order
FROM public.custom_home_pages chp
CROSS JOIN public.categories c
WHERE c.home_page_mode = 'default'
  AND NOT EXISTS (
    SELECT 1
    FROM public.custom_home_page_categories existing
    WHERE existing.custom_home_page_id = chp.id
      AND existing.category_id = c.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS custom_home_page_categories_page_category_uidx
ON public.custom_home_page_categories (custom_home_page_id, category_id);