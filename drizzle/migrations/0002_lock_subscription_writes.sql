DROP POLICY IF EXISTS "subs admin write" ON public.subscriptions;
CREATE POLICY "owners create unpaid sub" ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.is_business_admin(business_id) AND status = 'PAST_DUE' AND current_period_end IS NULL AND trial_ends_at IS NULL);
CREATE POLICY "super admin write subs" ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
ALTER TABLE public.subscriptions ALTER COLUMN status SET DEFAULT 'PAST_DUE';