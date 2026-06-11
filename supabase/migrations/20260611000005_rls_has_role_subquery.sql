-- Issue #9 (database audit): wrap has_role() calls in RLS policies with a
-- correlated subquery so PostgreSQL evaluates the function once per statement
-- rather than once per row.
--
-- has_role() is marked STABLE, but in RLS predicates PostgreSQL cannot always
-- hoist it out of the per-row evaluation loop automatically. The subquery form
-- (SELECT public.has_role(...)) forces a single evaluation per query regardless
-- of how many rows are scanned — important for large tables like content_items
-- and analytics_events where an admin query can scan hundreds of rows.
--
-- Each policy is dropped with IF EXISTS and recreated. The DROP+CREATE is
-- atomic within this migration file.

-- ── user_roles ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── categories ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can view published categories" ON public.categories;
CREATE POLICY "Anyone can view published categories"
  ON public.categories FOR SELECT TO anon, authenticated
  USING (published = true OR (SELECT public.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Contributors can manage categories" ON public.categories;
CREATE POLICY "Contributors can manage categories"
  ON public.categories FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'contributor')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'contributor')));

DROP POLICY IF EXISTS "Contributors can view categories drafts" ON public.categories;
CREATE POLICY "Contributors can view categories drafts"
  ON public.categories FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'contributor')));

-- ── content_items ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can view published content" ON public.content_items;
CREATE POLICY "Anyone can view published content"
  ON public.content_items FOR SELECT TO anon, authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'))
    OR (
      published = true
      AND EXISTS (
        SELECT 1 FROM public.categories c
        WHERE c.id = category_id AND c.published = true
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage content" ON public.content_items;
CREATE POLICY "Admins can manage content"
  ON public.content_items FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Contributors can manage content" ON public.content_items;
CREATE POLICY "Contributors can manage content"
  ON public.content_items FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'contributor')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'contributor')));

DROP POLICY IF EXISTS "contributors can write content_items" ON public.content_items;
CREATE POLICY "contributors can write content_items"
  ON public.content_items FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'contributor')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'contributor')));

-- ── content_types ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "admins and contributors can write content_types" ON public.content_types;
CREATE POLICY "admins and contributors can write content_types"
  ON public.content_types FOR ALL TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'))
    OR (SELECT public.has_role(auth.uid(), 'contributor'))
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'))
    OR (SELECT public.has_role(auth.uid(), 'contributor'))
  );

-- ── site_settings ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Admins can manage site settings"
  ON public.site_settings FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── ip_allowlist ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage ip allowlist" ON public.ip_allowlist;
CREATE POLICY "Admins can manage ip allowlist"
  ON public.ip_allowlist FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── analytics_events ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can read analytics events" ON public.analytics_events;
CREATE POLICY "Admins can read analytics events"
  ON public.analytics_events FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── custom_home_pages ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage custom home pages" ON public.custom_home_pages;
CREATE POLICY "Admins can manage custom home pages"
  ON public.custom_home_pages FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── custom_home_page_categories ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage custom home page categories" ON public.custom_home_page_categories;
CREATE POLICY "Admins can manage custom home page categories"
  ON public.custom_home_page_categories FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── user_profiles ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage profiles" ON public.user_profiles;
CREATE POLICY "Admins manage profiles"
  ON public.user_profiles FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── user_security_answers ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage security answers" ON public.user_security_answers;
CREATE POLICY "Admins manage security answers"
  ON public.user_security_answers FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── password_reset_attempts ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins read reset attempts" ON public.password_reset_attempts;
CREATE POLICY "Admins read reset attempts"
  ON public.password_reset_attempts FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));

DROP POLICY IF EXISTS "Admins manage reset attempts" ON public.password_reset_attempts;
CREATE POLICY "Admins manage reset attempts"
  ON public.password_reset_attempts FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── facilities ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can manage facilities" ON public.facilities;
CREATE POLICY "Admins can manage facilities"
  ON public.facilities FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── admin_audit_log ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── user_dismissed_messages ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage dismissals" ON public.user_dismissed_messages;
CREATE POLICY "Admins manage dismissals"
  ON public.user_dismissed_messages FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── signup_attempts ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage signup attempts" ON public.signup_attempts;
CREATE POLICY "Admins manage signup attempts"
  ON public.signup_attempts FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── error_logs ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage error logs" ON public.error_logs;
CREATE POLICY "Admins manage error logs"
  ON public.error_logs FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── user_content_progress ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage progress" ON public.user_content_progress;
CREATE POLICY "Admins manage progress"
  ON public.user_content_progress FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── user_logins ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins manage logins" ON public.user_logins;
CREATE POLICY "Admins manage logins"
  ON public.user_logins FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin')));

-- ── category_facilities ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can insert category_facilities" ON public.category_facilities;
CREATE POLICY "Admins can insert category_facilities"
  ON public.category_facilities FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'contributor')
    )
  );

DROP POLICY IF EXISTS "Admins can delete category_facilities" ON public.category_facilities;
CREATE POLICY "Admins can delete category_facilities"
  ON public.category_facilities FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'contributor')
    )
  );

-- ── content_item_facilities ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin contributor insert content_item_facilities" ON public.content_item_facilities;
CREATE POLICY "Admin contributor insert content_item_facilities"
  ON public.content_item_facilities FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'contributor')
    )
  );

DROP POLICY IF EXISTS "Admin contributor delete content_item_facilities" ON public.content_item_facilities;
CREATE POLICY "Admin contributor delete content_item_facilities"
  ON public.content_item_facilities FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'contributor')
    )
  );

-- ── storage.objects (category-icons bucket) ───────────────────────────────────

DROP POLICY IF EXISTS "category_icons_admin_insert" ON storage.objects;
CREATE POLICY "category_icons_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'category-icons'
    AND (
      (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
      OR (SELECT public.has_role(auth.uid(), 'contributor'::public.app_role))
    )
  );

DROP POLICY IF EXISTS "category_icons_admin_update" ON storage.objects;
CREATE POLICY "category_icons_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'category-icons'
    AND (
      (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
      OR (SELECT public.has_role(auth.uid(), 'contributor'::public.app_role))
    )
  )
  WITH CHECK (
    bucket_id = 'category-icons'
    AND (
      (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
      OR (SELECT public.has_role(auth.uid(), 'contributor'::public.app_role))
    )
  );

DROP POLICY IF EXISTS "category_icons_admin_delete" ON storage.objects;
CREATE POLICY "category_icons_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'category-icons'
    AND (
      (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
      OR (SELECT public.has_role(auth.uid(), 'contributor'::public.app_role))
    )
  );
