CREATE TABLE public.visit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PENDING',
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.visit_requests TO authenticated;
GRANT ALL ON public.visit_requests TO service_role;
ALTER TABLE public.visit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business admins view visit requests" ON public.visit_requests FOR SELECT TO authenticated USING (public.is_business_admin(business_id));
CREATE POLICY "Business admins decide visit requests" ON public.visit_requests FOR UPDATE TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));
CREATE INDEX visit_requests_business_status_idx ON public.visit_requests(business_id, status, created_at DESC);
CREATE UNIQUE INDEX visit_requests_one_pending ON public.visit_requests(customer_id) WHERE status = 'PENDING';