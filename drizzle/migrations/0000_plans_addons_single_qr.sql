ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS duration_months integer NOT NULL DEFAULT 12;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS contact_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS addon_code text;

CREATE TABLE public.addons (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  price_yearly numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.addons TO anon, authenticated;
GRANT ALL ON public.addons TO service_role;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addons readable" ON public.addons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "addons admin write" ON public.addons FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
GRANT INSERT, UPDATE, DELETE ON public.addons TO authenticated;

CREATE TABLE public.business_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  addon_code text NOT NULL REFERENCES public.addons(code),
  status text NOT NULL DEFAULT 'ACTIVE',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, addon_code)
);
GRANT SELECT ON public.business_addons TO authenticated;
GRANT ALL ON public.business_addons TO service_role;
ALTER TABLE public.business_addons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read addons" ON public.business_addons FOR SELECT TO authenticated USING (public.is_business_member(business_id));

CREATE TABLE public.review_settings (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  highlights text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.review_settings TO authenticated;
GRANT ALL ON public.review_settings TO service_role;
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage review settings" ON public.review_settings FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

CREATE OR REPLACE FUNCTION public.addon_active(_business_id uuid, _code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.business_addons WHERE business_id=_business_id AND addon_code=_code AND status='ACTIVE' AND expires_at > now())
$$;

CREATE OR REPLACE FUNCTION public.branch_limit_ok(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.branches WHERE business_id=_business_id)
       < COALESCE((SELECT p.max_branches FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id WHERE s.business_id=_business_id LIMIT 1), 1)
$$;

CREATE OR REPLACE FUNCTION public.enforce_branch_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_super_admin() THEN RETURN NEW; END IF;
  IF NOT public.branch_limit_ok(NEW.business_id) THEN
    RAISE EXCEPTION 'Your plan allows only % branch(es). Contact us for the Multiple Branches plan.',
      COALESCE((SELECT p.max_branches FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id WHERE s.business_id=NEW.business_id LIMIT 1),1);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_branch_limit BEFORE INSERT ON public.branches FOR EACH ROW EXECUTE FUNCTION public.enforce_branch_limit();

CREATE OR REPLACE FUNCTION public.enforce_single_qr()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.qr_codes WHERE business_id = NEW.business_id) THEN
    RAISE EXCEPTION 'Each shop has one permanent QR code.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_single_qr BEFORE INSERT ON public.qr_codes FOR EACH ROW EXECUTE FUNCTION public.enforce_single_qr();

CREATE OR REPLACE FUNCTION public.enforce_visit_target()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stamps_required NOT IN (5,10,20) THEN RAISE EXCEPTION 'Visit target must be 5, 10 or 20'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_visit_target BEFORE INSERT OR UPDATE OF stamps_required ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.enforce_visit_target();