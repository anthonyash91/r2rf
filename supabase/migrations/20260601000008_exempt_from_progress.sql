-- Add exempt_from_progress flag to content_items.
-- Items marked exempt still appear in the UI and can be "Acknowledged" by users,
-- but are excluded from all completion counts, progress bars, and analytics aggregates.
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS exempt_from_progress BOOLEAN NOT NULL DEFAULT FALSE;

-- Rebuild refresh_analytics_stats() to exclude exempt items from all completion metrics.
CREATE OR REPLACE FUNCTION public.refresh_analytics_stats()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN

  -- content_item_stats: skip exempt items entirely
  INSERT INTO content_item_stats (
    content_item_id, open_count, complete_count, completion_rate,
    avg_session_seconds, avg_media_progress_pct, drop_off_count, total_session_seconds, updated_at
  )
  SELECT ci.id,
    GREATEST(COALESCE(o.open_count,0), COALESCE(p.complete_count,0)),
    COALESCE(p.complete_count,0),
    CASE WHEN GREATEST(COALESCE(o.open_count,0), COALESCE(p.complete_count,0)) > 0
      THEN ROUND(COALESCE(p.complete_count,0)::numeric / GREATEST(COALESCE(o.open_count,0), COALESCE(p.complete_count,0)) * 100, 2)
      ELSE 0 END,
    s.avg_session_seconds, e.avg_media_pct,
    GREATEST(0, GREATEST(COALESCE(o.open_count,0), COALESCE(p.complete_count,0)) - COALESCE(p.complete_count,0)),
    COALESCE(s.total_session_seconds,0), now()
  FROM content_items ci
  LEFT JOIN (
    SELECT content_item_id, COUNT(DISTINCT user_id) AS open_count FROM (
      SELECT ucs.user_id, ucs.content_item_id FROM user_content_sessions ucs
      LEFT JOIN user_roles ur ON ur.user_id = ucs.user_id AND ur.role IN ('admin','contributor','tester','facilityUser') WHERE ur.user_id IS NULL
      UNION
      SELECT ae.user_id, ae.content_id FROM analytics_events ae
      LEFT JOIN user_roles ur ON ur.user_id = ae.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')
      WHERE ae.event_type = 'content_click' AND ae.user_id IS NOT NULL AND ur.user_id IS NULL
    ) opens GROUP BY content_item_id
  ) o ON o.content_item_id = ci.id
  LEFT JOIN (
    SELECT ucs.content_item_id,
           SUM(ucs.session_seconds)::numeric / NULLIF(COUNT(DISTINCT ucs.user_id),0) AS avg_session_seconds,
           SUM(ucs.session_seconds) AS total_session_seconds
    FROM user_content_sessions ucs
    LEFT JOIN user_roles ur ON ur.user_id = ucs.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')
    WHERE ur.user_id IS NULL GROUP BY ucs.content_item_id
  ) s ON s.content_item_id = ci.id
  LEFT JOIN (
    SELECT uce.content_item_id,
           AVG(CASE WHEN uce.media_duration_seconds > 0 THEN uce.media_progress_seconds / uce.media_duration_seconds * 100 ELSE NULL END) AS avg_media_pct
    FROM user_content_engagement uce
    LEFT JOIN user_roles ur ON ur.user_id = uce.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')
    WHERE uce.session_seconds > 0 AND ur.user_id IS NULL GROUP BY uce.content_item_id
  ) e ON e.content_item_id = ci.id
  LEFT JOIN (
    SELECT ucp.content_item_id, COUNT(DISTINCT ucp.user_id) AS complete_count
    FROM user_content_progress ucp
    LEFT JOIN user_roles ur ON ur.user_id = ucp.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')
    WHERE ur.user_id IS NULL GROUP BY ucp.content_item_id
  ) p ON p.content_item_id = ci.id
  WHERE ci.exempt_from_progress = FALSE
  ON CONFLICT (content_item_id) DO UPDATE SET
    open_count = EXCLUDED.open_count, complete_count = EXCLUDED.complete_count,
    completion_rate = EXCLUDED.completion_rate, avg_session_seconds = EXCLUDED.avg_session_seconds,
    avg_media_progress_pct = EXCLUDED.avg_media_progress_pct, drop_off_count = EXCLUDED.drop_off_count,
    total_session_seconds = EXCLUDED.total_session_seconds, updated_at = EXCLUDED.updated_at;

  -- facility_stats: exclude exempt items from completion rate, items_completed_total
  INSERT INTO facility_stats (
    facility_value, active_users_7d, active_users_30d, total_users,
    avg_completion_rate, total_session_seconds, items_completed_total,
    bookmark_count, thumbs_up_count, thumbs_down_count,
    updated_at
  )
  SELECT f.value,
    COUNT(DISTINCT up.user_id) FILTER (WHERE ucs_active.recorded_at >= now() - interval '7 days'),
    COUNT(DISTINCT up.user_id) FILTER (WHERE ucs_active.recorded_at >= now() - interval '30 days'),
    COUNT(DISTINCT up.user_id),
    (SELECT CASE WHEN GREATEST(fac_eng.cnt, fac_comp.cnt) > 0 THEN ROUND(fac_comp.cnt::numeric / GREATEST(fac_eng.cnt, fac_comp.cnt) * 100, 2) ELSE NULL END
     FROM (SELECT COUNT(*) AS cnt FROM (
       SELECT DISTINCT ae2.user_id, ae2.content_id FROM analytics_events ae2
       JOIN user_profiles up2b ON up2b.user_id = ae2.user_id AND up2b.facility = f.value
       JOIN content_items ci2b ON ci2b.id = ae2.content_id AND ci2b.exempt_from_progress = FALSE
       LEFT JOIN user_roles ur2b ON ur2b.user_id = ae2.user_id AND ur2b.role IN ('admin','contributor','tester','facilityUser')
       WHERE ur2b.user_id IS NULL AND ae2.event_type = 'content_click' AND ae2.user_id IS NOT NULL
     ) eng_pairs) fac_eng,
     (SELECT COUNT(*) AS cnt FROM (
       SELECT DISTINCT ucp2.user_id, ucp2.content_item_id FROM user_content_progress ucp2
       JOIN user_profiles up3 ON up3.user_id = ucp2.user_id AND up3.facility = f.value
       JOIN content_items ci3 ON ci3.id = ucp2.content_item_id AND ci3.exempt_from_progress = FALSE
       LEFT JOIN user_roles ur3 ON ur3.user_id = ucp2.user_id AND ur3.role IN ('admin','contributor','tester','facilityUser') WHERE ur3.user_id IS NULL
     ) comp_pairs) fac_comp),
    COALESCE((SELECT SUM(ucs2.session_seconds) FROM user_content_sessions ucs2
      JOIN user_profiles up2 ON up2.user_id = ucs2.user_id AND up2.facility = f.value
      LEFT JOIN user_roles ur2 ON ur2.user_id = up2.user_id AND ur2.role IN ('admin','contributor','tester','facilityUser') WHERE ur2.user_id IS NULL), 0),
    COALESCE((SELECT COUNT(*) FROM user_content_progress ucp2
      JOIN user_profiles up3 ON up3.user_id = ucp2.user_id AND up3.facility = f.value
      JOIN content_items ci3 ON ci3.id = ucp2.content_item_id AND ci3.exempt_from_progress = FALSE
      LEFT JOIN user_roles ur3 ON ur3.user_id = up3.user_id AND ur3.role IN ('admin','contributor','tester','facilityUser') WHERE ur3.user_id IS NULL), 0),
    COALESCE((
      SELECT COUNT(*) FROM user_content_bookmarks ucb
      JOIN user_profiles up2 ON up2.user_id = ucb.user_id AND up2.facility = f.value
      LEFT JOIN user_roles ur2 ON ur2.user_id = ucb.user_id AND ur2.role IN ('admin','contributor','tester','facilityUser')
      WHERE ur2.user_id IS NULL
    ), 0),
    COALESCE((
      SELECT COUNT(*) FROM user_content_ratings ucr
      JOIN user_profiles up2 ON up2.user_id = ucr.user_id AND up2.facility = f.value
      LEFT JOIN user_roles ur2 ON ur2.user_id = ucr.user_id AND ur2.role IN ('admin','contributor','tester','facilityUser')
      WHERE ur2.user_id IS NULL AND ucr.rating = 1
    ), 0),
    COALESCE((
      SELECT COUNT(*) FROM user_content_ratings ucr
      JOIN user_profiles up2 ON up2.user_id = ucr.user_id AND up2.facility = f.value
      LEFT JOIN user_roles ur2 ON ur2.user_id = ucr.user_id AND ur2.role IN ('admin','contributor','tester','facilityUser')
      WHERE ur2.user_id IS NULL AND ucr.rating = -1
    ), 0),
    now()
  FROM facilities f
  JOIN user_profiles up ON up.facility = f.value
  LEFT JOIN user_roles ur ON ur.user_id = up.user_id AND ur.role = 'facilityUser'
  LEFT JOIN user_content_sessions ucs_active ON ucs_active.user_id = up.user_id AND ur.user_id IS NULL
  WHERE ur.user_id IS NULL GROUP BY f.value
  ON CONFLICT (facility_value) DO UPDATE SET
    active_users_7d = EXCLUDED.active_users_7d, active_users_30d = EXCLUDED.active_users_30d,
    total_users = EXCLUDED.total_users, avg_completion_rate = EXCLUDED.avg_completion_rate,
    total_session_seconds = EXCLUDED.total_session_seconds, items_completed_total = EXCLUDED.items_completed_total,
    bookmark_count = EXCLUDED.bookmark_count,
    thumbs_up_count = EXCLUDED.thumbs_up_count,
    thumbs_down_count = EXCLUDED.thumbs_down_count,
    updated_at = EXCLUDED.updated_at;

  -- user_stats: exclude exempt items from items_completed count
  INSERT INTO user_stats (user_id, facility_value, items_completed, items_started, total_session_seconds, facility_percentile, updated_at)
  SELECT up.user_id, up.facility,
    COUNT(DISTINCT ucp.content_item_id),
    COUNT(DISTINCT ucs.content_item_id),
    COALESCE(SUM(ucs.session_seconds), 0),
    ROUND((PERCENT_RANK() OVER (PARTITION BY up.facility ORDER BY COALESCE(SUM(ucs.session_seconds),0) ASC) * 100)::numeric, 1),
    now()
  FROM user_profiles up
  LEFT JOIN user_roles ur ON ur.user_id = up.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')
  LEFT JOIN user_content_sessions ucs ON ucs.user_id = up.user_id
  LEFT JOIN (
    SELECT ucp_inner.user_id, ucp_inner.content_item_id
    FROM user_content_progress ucp_inner
    JOIN content_items ci ON ci.id = ucp_inner.content_item_id AND ci.exempt_from_progress = FALSE
  ) ucp ON ucp.user_id = up.user_id
  WHERE ur.user_id IS NULL GROUP BY up.user_id, up.facility
  ON CONFLICT (user_id) DO UPDATE SET
    facility_value = EXCLUDED.facility_value, items_completed = EXCLUDED.items_completed,
    items_started = EXCLUDED.items_started, total_session_seconds = EXCLUDED.total_session_seconds,
    facility_percentile = EXCLUDED.facility_percentile, updated_at = EXCLUDED.updated_at;

  DELETE FROM analytics_retention WHERE TRUE;
  WITH eligible AS (
    SELECT up.user_id, up.facility, up.created_at::date AS signup_date FROM user_profiles up
    LEFT JOIN user_roles ur ON ur.user_id = up.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')
    WHERE ur.user_id IS NULL AND up.is_synthetic = false
  ), first_returns AS (
    SELECT ul.user_id, MIN(ul.login_date - e.signup_date) AS days_to_return
    FROM user_logins ul JOIN eligible e ON e.user_id = ul.user_id AND ul.login_date > e.signup_date GROUP BY ul.user_id
  )
  INSERT INTO analytics_retention (facility_value, day7_rate, day30_rate, day60_rate, total_users, updated_at)
  SELECT NULL,
    ROUND(COUNT(fr.user_id) FILTER (WHERE fr.days_to_return<=7  AND e.signup_date<=CURRENT_DATE-7)::numeric  /NULLIF(COUNT(e.user_id) FILTER (WHERE e.signup_date<=CURRENT_DATE-7),0)*100,1),
    ROUND(COUNT(fr.user_id) FILTER (WHERE fr.days_to_return<=30 AND e.signup_date<=CURRENT_DATE-30)::numeric /NULLIF(COUNT(e.user_id) FILTER (WHERE e.signup_date<=CURRENT_DATE-30),0)*100,1),
    ROUND(COUNT(fr.user_id) FILTER (WHERE fr.days_to_return<=60 AND e.signup_date<=CURRENT_DATE-60)::numeric /NULLIF(COUNT(e.user_id) FILTER (WHERE e.signup_date<=CURRENT_DATE-60),0)*100,1),
    COUNT(DISTINCT e.user_id), now()
  FROM eligible e LEFT JOIN first_returns fr ON fr.user_id = e.user_id
  UNION ALL
  SELECT e.facility,
    ROUND(COUNT(fr.user_id) FILTER (WHERE fr.days_to_return<=7  AND e.signup_date<=CURRENT_DATE-7)::numeric  /NULLIF(COUNT(e.user_id) FILTER (WHERE e.signup_date<=CURRENT_DATE-7),0)*100,1),
    ROUND(COUNT(fr.user_id) FILTER (WHERE fr.days_to_return<=30 AND e.signup_date<=CURRENT_DATE-30)::numeric /NULLIF(COUNT(e.user_id) FILTER (WHERE e.signup_date<=CURRENT_DATE-30),0)*100,1),
    ROUND(COUNT(fr.user_id) FILTER (WHERE fr.days_to_return<=60 AND e.signup_date<=CURRENT_DATE-60)::numeric /NULLIF(COUNT(e.user_id) FILTER (WHERE e.signup_date<=CURRENT_DATE-60),0)*100,1),
    COUNT(DISTINCT e.user_id), now()
  FROM eligible e LEFT JOIN first_returns fr ON fr.user_id = e.user_id
  WHERE e.facility IS NOT NULL GROUP BY e.facility;

  DELETE FROM analytics_weekly_growth WHERE TRUE;
  WITH eligible AS (
    SELECT up.user_id, up.facility, up.created_at::date AS signup_date FROM user_profiles up
    LEFT JOIN user_roles ur ON ur.user_id = up.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')
    WHERE ur.user_id IS NULL AND up.is_synthetic = false
  ), weeks AS (
    SELECT (CURRENT_DATE-(n*7)) AS week_end, (CURRENT_DATE-(n*7)-6) AS week_start FROM generate_series(0,11) n
  ), weekly_signups AS (
    SELECT w.week_end, e.facility, COUNT(e.user_id) AS signups
    FROM weeks w LEFT JOIN eligible e ON e.signup_date BETWEEN w.week_start AND w.week_end GROUP BY w.week_end, e.facility
  ), weekly_active AS (
    SELECT w.week_end, up.facility, COUNT(DISTINCT ae.user_id) AS active_users FROM weeks w
    LEFT JOIN analytics_events ae ON ae.created_at::date BETWEEN w.week_start AND w.week_end AND ae.user_id IS NOT NULL
    LEFT JOIN eligible up ON up.user_id = ae.user_id GROUP BY w.week_end, up.facility
  )
  INSERT INTO analytics_weekly_growth (facility_value, week_ending, signups, active_users, updated_at)
  SELECT NULL, w.week_end, COALESCE(SUM(ws.signups),0), COALESCE(SUM(wa.active_users),0), now()
  FROM weeks w LEFT JOIN weekly_signups ws ON ws.week_end=w.week_end LEFT JOIN weekly_active wa ON wa.week_end=w.week_end GROUP BY w.week_end
  UNION ALL
  SELECT f.value, w.week_end, COALESCE(ws.signups,0), COALESCE(wa.active_users,0), now()
  FROM facilities f CROSS JOIN weeks w
  LEFT JOIN weekly_signups ws ON ws.week_end=w.week_end AND ws.facility=f.value
  LEFT JOIN weekly_active wa ON wa.week_end=w.week_end AND wa.facility=f.value;

  DELETE FROM analytics_program_completion WHERE TRUE;
  WITH eligible AS (
    SELECT up.user_id, up.facility FROM user_profiles up
    LEFT JOIN user_roles ur ON ur.user_id = up.user_id AND ur.role IN ('admin','contributor','tester','facilityUser')
    WHERE ur.user_id IS NULL AND up.is_synthetic = false
  ), cat_item_counts AS (
    -- Only count non-exempt published items toward category totals
    SELECT ci.category_id, COUNT(*) AS total_items FROM content_items ci
    WHERE ci.published = true AND ci.exempt_from_progress = FALSE
    GROUP BY ci.category_id
  ), user_cat_completions AS (
    SELECT e.user_id, e.facility, ci.category_id, COUNT(DISTINCT ucp.content_item_id) AS items_done, cic.total_items
    FROM eligible e JOIN user_content_progress ucp ON ucp.user_id=e.user_id
    JOIN content_items ci ON ci.id=ucp.content_item_id AND ci.published=true AND ci.exempt_from_progress = FALSE
    JOIN cat_item_counts cic ON cic.category_id=ci.category_id
    GROUP BY e.user_id, e.facility, ci.category_id, cic.total_items
  )
  INSERT INTO analytics_program_completion (category_id, facility_value, name, total_items, users_engaged, users_completed, completion_rate, updated_at)
  SELECT c.id, NULL, c.name, COALESCE(cic.total_items,0), COUNT(DISTINCT ucc.user_id),
    COUNT(DISTINCT ucc.user_id) FILTER (WHERE ucc.items_done>=ucc.total_items),
    ROUND(COUNT(DISTINCT ucc.user_id) FILTER (WHERE ucc.items_done>=ucc.total_items)::numeric/NULLIF(COUNT(DISTINCT ucc.user_id),0)*100,1), now()
  FROM categories c LEFT JOIN cat_item_counts cic ON cic.category_id=c.id
  LEFT JOIN user_cat_completions ucc ON ucc.category_id=c.id WHERE c.published=true GROUP BY c.id, c.name, cic.total_items
  UNION ALL
  SELECT c.id, f.value, c.name, COALESCE(cic.total_items,0), COUNT(DISTINCT ucc.user_id),
    COUNT(DISTINCT ucc.user_id) FILTER (WHERE ucc.items_done>=ucc.total_items),
    ROUND(COUNT(DISTINCT ucc.user_id) FILTER (WHERE ucc.items_done>=ucc.total_items)::numeric/NULLIF(COUNT(DISTINCT ucc.user_id),0)*100,1), now()
  FROM categories c CROSS JOIN facilities f LEFT JOIN cat_item_counts cic ON cic.category_id=c.id
  LEFT JOIN user_cat_completions ucc ON ucc.category_id=c.id AND ucc.facility=f.value
  WHERE c.published=true GROUP BY c.id, c.name, f.value, cic.total_items;

END;
$function$;
