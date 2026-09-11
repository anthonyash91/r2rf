-- facilityUser accounts could previously read every facility's row in
-- facility_stats (only admin-or-facilityUser was checked, not which
-- facility). Scope facilityUser callers to their own facility, matching the
-- isFacilityScoped() pattern already used in server-side reporting code.
DROP POLICY IF EXISTS "Admins and facility users read facility stats" ON public.facility_stats;

CREATE POLICY "Admins and facility users read facility stats"
  ON public.facility_stats FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'))
    OR (
      (SELECT public.has_role(auth.uid(), 'facilityUser'))
      AND facility_value = (
        SELECT facility FROM public.user_profiles WHERE user_id = auth.uid()
      )
    )
  );
