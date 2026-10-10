ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS custom_max_branches integer, ADD COLUMN IF NOT EXISTS custom_price numeric, ADD COLUMN IF NOT EXISTS notes text, ADD COLUMN IF NOT EXISTS activated_at timestamptz;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'UPI', ADD COLUMN IF NOT EXISTS verified_by uuid, ADD COLUMN IF NOT EXISTS verified_at timestamptz, ADD COLUMN IF NOT EXISTS admin_notes text, ADD COLUMN IF NOT EXISTS paid_at timestamptz, ADD COLUMN IF NOT EXISTS payment_mode text;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS created_by_admin uuid;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS dietary_label text, ADD COLUMN IF NOT EXISTS enquiry_enabled boolean NOT NULL DEFAULT false;

CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1001;
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  validity text,
  period_start timestamptz,
  period_end timestamptz,
  amount numeric NOT NULL,
  discount numeric NOT NULL DEFAULT 0,
  tax_rate numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  method text NOT NULL,
  reference text,
  status text NOT NULL DEFAULT 'PAID',
  billing jsonb NOT NULL DEFAULT '{}'::jsonb,
  seller jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read invoices" ON public.invoices FOR SELECT TO authenticated USING (public.is_business_member(business_id));

CREATE TABLE public.subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  admin_id uuid,
  action text NOT NULL,
  old_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_history TO authenticated;
GRANT ALL ON public.subscription_history TO service_role;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read sub history" ON public.subscription_history FOR SELECT TO authenticated USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.next_invoice_number() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT 'DU-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text, 6, '0')
$$;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;

CREATE OR REPLACE FUNCTION public.branch_limit_ok(_business_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT (SELECT count(*) FROM public.branches WHERE business_id=_business_id)
       < COALESCE((SELECT COALESCE(s.custom_max_branches, p.max_branches) FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id WHERE s.business_id=_business_id LIMIT 1), 1)
$function$;