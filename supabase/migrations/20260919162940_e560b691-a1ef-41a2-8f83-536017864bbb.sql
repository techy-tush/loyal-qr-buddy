-- ENUMS
CREATE TYPE public.platform_role AS ENUM ('SUPER_ADMIN','BUSINESS_OWNER','BUSINESS_MANAGER','STAFF','CUSTOMER');
CREATE TYPE public.staff_role AS ENUM ('BUSINESS_OWNER','BUSINESS_MANAGER','STAFF');
CREATE TYPE public.reward_status AS ENUM ('AVAILABLE','REDEEMED','EXPIRED','CANCELLED');
CREATE TYPE public.offer_type AS ENUM ('PERCENT','FLAT','BOGO','FREE_PRODUCT','CUSTOM');
CREATE TYPE public.audience_type AS ENUM ('ALL','NEW','REPEAT','INACTIVE','VIP');
CREATE TYPE public.qr_type AS ENUM ('BUSINESS','BRANCH','CAMPAIGN','MENU','LOYALTY');
CREATE TYPE public.sub_status AS ENUM ('TRIAL','ACTIVE','PAST_DUE','CANCELLED','SUSPENDED');
CREATE TYPE public.business_status AS ENUM ('ACTIVE','SUSPENDED','PENDING');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  mobile TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.platform_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.platform_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'SUPER_ADMIN')
$$;

-- PLANS
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_branches INTEGER NOT NULL DEFAULT 1,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public read" ON public.plans FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "plans admin manage" ON public.plans FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- BUSINESSES
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  logo_url TEXT,
  status public.business_status NOT NULL DEFAULT 'ACTIVE',
  stamp_mode TEXT NOT NULL DEFAULT 'STAFF_APPROVAL',
  stamp_cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  daily_stamp_limit INTEGER NOT NULL DEFAULT 1,
  location_validation BOOLEAN NOT NULL DEFAULT false,
  google_review_url TEXT,
  instagram_url TEXT,
  whatsapp_number TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.business_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  branch_id UUID,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role public.staff_role NOT NULL DEFAULT 'STAFF',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_staff TO authenticated;
GRANT ALL ON public.business_staff TO service_role;
ALTER TABLE public.business_staff ENABLE ROW LEVEL SECURITY;

-- ACCESS HELPERS
CREATE OR REPLACE FUNCTION public.is_business_member(_business_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.business_staff s WHERE s.business_id = _business_id AND s.user_id = auth.uid() AND s.is_active)
      OR public.is_super_admin()
$$;

CREATE OR REPLACE FUNCTION public.is_business_admin(_business_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = _business_id AND b.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.business_staff s WHERE s.business_id = _business_id AND s.user_id = auth.uid()
                 AND s.is_active AND s.role IN ('BUSINESS_OWNER','BUSINESS_MANAGER'))
      OR public.is_super_admin()
$$;

CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "roles self read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "businesses member read" ON public.businesses FOR SELECT TO authenticated USING (public.is_business_member(id));
CREATE POLICY "businesses owner insert" ON public.businesses FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "businesses admin update" ON public.businesses FOR UPDATE TO authenticated USING (public.is_business_admin(id)) WITH CHECK (public.is_business_admin(id));
CREATE POLICY "businesses owner delete" ON public.businesses FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "staff member read" ON public.business_staff FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "staff admin write" ON public.business_staff FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

-- BRANCHES
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  opening_time TEXT,
  closing_time TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches member read" ON public.branches FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "branches admin write" ON public.branches FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));
CREATE INDEX idx_branches_business ON public.branches(business_id);

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  dob DATE,
  anniversary DATE,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  total_visits INTEGER NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, phone)
);
CREATE UNIQUE INDEX idx_customers_token ON public.customers(access_token);
CREATE INDEX idx_customers_business ON public.customers(business_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers member read" ON public.customers FOR SELECT TO authenticated USING (public.is_business_member(business_id) OR user_id = auth.uid());
CREATE POLICY "customers member write" ON public.customers FOR ALL TO authenticated USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));

-- LOYALTY
CREATE TABLE public.loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name TEXT NOT NULL,
  stamps_required INTEGER NOT NULL DEFAULT 10,
  reward_type TEXT NOT NULL DEFAULT 'FREE_PRODUCT',
  reward_description TEXT NOT NULL,
  reward_expiry_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_programs TO authenticated;
GRANT ALL ON public.loyalty_programs TO service_role;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs member read" ON public.loyalty_programs FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "programs admin write" ON public.loyalty_programs FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

CREATE TABLE public.loyalty_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs ON DELETE CASCADE,
  stamps INTEGER NOT NULL DEFAULT 0,
  cycles_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, program_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_cards TO authenticated;
GRANT ALL ON public.loyalty_cards TO service_role;
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards member read" ON public.loyalty_cards FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "cards member write" ON public.loyalty_cards FOR ALL TO authenticated USING (public.is_business_member(business_id)) WITH CHECK (public.is_business_member(business_id));

CREATE TABLE public.stamp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.loyalty_cards ON DELETE CASCADE,
  issued_by UUID REFERENCES auth.users ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'STAFF',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stamp_events_business_date ON public.stamp_events(business_id, created_at DESC);
CREATE INDEX idx_stamp_events_customer ON public.stamp_events(customer_id, created_at DESC);
GRANT SELECT, INSERT ON public.stamp_events TO authenticated;
GRANT ALL ON public.stamp_events TO service_role;
ALTER TABLE public.stamp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stamps member read" ON public.stamp_events FOR SELECT TO authenticated USING (public.is_business_member(business_id));

CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers ON DELETE CASCADE,
  program_id UUID REFERENCES public.loyalty_programs ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE DEFAULT upper(encode(gen_random_bytes(4),'hex')),
  description TEXT NOT NULL,
  status public.reward_status NOT NULL DEFAULT 'AVAILABLE',
  source TEXT NOT NULL DEFAULT 'LOYALTY',
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rewards_business ON public.rewards(business_id, status);
CREATE INDEX idx_rewards_customer ON public.rewards(customer_id);
GRANT SELECT, INSERT, UPDATE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards member read" ON public.rewards FOR SELECT TO authenticated USING (public.is_business_member(business_id));

-- OFFERS
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  offer_type public.offer_type NOT NULL DEFAULT 'PERCENT',
  discount_value NUMERIC(10,2),
  starts_at DATE,
  ends_at DATE,
  usage_limit INTEGER,
  audience public.audience_type NOT NULL DEFAULT 'ALL',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers member read" ON public.offers FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "offers admin write" ON public.offers FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

CREATE TABLE public.offer_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES public.offers ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.offer_redemptions TO authenticated;
GRANT ALL ON public.offer_redemptions TO service_role;
ALTER TABLE public.offer_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offer_red member read" ON public.offer_redemptions FOR SELECT TO authenticated USING (public.is_business_member(business_id));

-- SCRATCH CARDS
CREATE TABLE public.scratch_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name TEXT NOT NULL,
  starts_at DATE,
  ends_at DATE,
  trigger TEXT NOT NULL DEFAULT 'ON_VISIT',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scratch_campaigns TO authenticated;
GRANT ALL ON public.scratch_campaigns TO service_role;
ALTER TABLE public.scratch_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scratch member read" ON public.scratch_campaigns FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "scratch admin write" ON public.scratch_campaigns FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

CREATE TABLE public.scratch_prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.scratch_campaigns ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  label TEXT NOT NULL,
  probability NUMERIC(5,2) NOT NULL DEFAULT 10,
  reward_description TEXT,
  is_win BOOLEAN NOT NULL DEFAULT true,
  expiry_days INTEGER NOT NULL DEFAULT 14,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scratch_prizes TO authenticated;
GRANT ALL ON public.scratch_prizes TO service_role;
ALTER TABLE public.scratch_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prizes member read" ON public.scratch_prizes FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "prizes admin write" ON public.scratch_prizes FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

CREATE TABLE public.scratch_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.scratch_campaigns ON DELETE CASCADE,
  prize_id UUID REFERENCES public.scratch_prizes ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.customers ON DELETE CASCADE,
  reward_id UUID REFERENCES public.rewards ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, customer_id)
);
GRANT SELECT ON public.scratch_wins TO authenticated;
GRANT ALL ON public.scratch_wins TO service_role;
ALTER TABLE public.scratch_wins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wins member read" ON public.scratch_wins FOR SELECT TO authenticated USING (public.is_business_member(business_id));

-- MENU
CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT ALL ON public.menu_categories TO service_role;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menucat member read" ON public.menu_categories FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "menucat admin write" ON public.menu_categories FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.menu_categories ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menuitem member read" ON public.menu_items FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "menuitem admin write" ON public.menu_items FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

-- FEEDBACK
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers ON DELETE SET NULL,
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback member read" ON public.feedback FOR SELECT TO authenticated USING (public.is_business_member(business_id));

-- QR
CREATE TABLE public.qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches ON DELETE CASCADE,
  label TEXT NOT NULL,
  qr_type public.qr_type NOT NULL DEFAULT 'BUSINESS',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12),'hex'),
  scan_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_codes TO authenticated;
GRANT ALL ON public.qr_codes TO service_role;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qr member read" ON public.qr_codes FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "qr admin write" ON public.qr_codes FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

CREATE TABLE public.qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  qr_id UUID REFERENCES public.qr_codes ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_qr_scans_business_date ON public.qr_scans(business_id, created_at DESC);
GRANT SELECT ON public.qr_scans TO authenticated;
GRANT ALL ON public.qr_scans TO service_role;
ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scans member read" ON public.qr_scans FOR SELECT TO authenticated USING (public.is_business_member(business_id));

-- SUBSCRIPTIONS / PAYMENTS
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans,
  status public.sub_status NOT NULL DEFAULT 'TRIAL',
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_sub_business ON public.subscriptions(business_id);
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs member read" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "subs admin write" ON public.subscriptions FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  provider TEXT NOT NULL DEFAULT 'MANUAL',
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  invoice_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments member read" ON public.payments FOR SELECT TO authenticated USING (public.is_business_member(business_id));

-- CAMPAIGNS / NOTIFICATIONS / AUDIT / SUPPORT
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'BROADCAST',
  audience public.audience_type NOT NULL DEFAULT 'ALL',
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  message TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns member read" ON public.campaigns FOR SELECT TO authenticated USING (public.is_business_member(business_id));
CREATE POLICY "campaigns admin write" ON public.campaigns FOR ALL TO authenticated USING (public.is_business_admin(business_id)) WITH CHECK (public.is_business_admin(business_id));

CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns ON DELETE SET NULL,
  event TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'EMAIL',
  provider TEXT NOT NULL DEFAULT 'NOOP',
  status TEXT NOT NULL DEFAULT 'QUEUED',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif member read" ON public.notification_logs FOR SELECT TO authenticated USING (public.is_business_member(business_id));

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit member read" ON public.audit_logs FOR SELECT TO authenticated USING (business_id IS NOT NULL AND public.is_business_member(business_id));

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES public.businesses ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets member read" ON public.support_tickets FOR SELECT TO authenticated USING (public.is_super_admin() OR (business_id IS NOT NULL AND public.is_business_member(business_id)));
CREATE POLICY "tickets member insert" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (business_id IS NOT NULL AND public.is_business_member(business_id));
CREATE POLICY "tickets admin update" ON public.support_tickets FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- TRIGGERS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_businesses_updated BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cards_updated BEFORE UPDATE ON public.loyalty_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, mobile)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, NEW.raw_user_meta_data->>'mobile')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FEEDBACK rating guard
CREATE OR REPLACE FUNCTION public.validate_feedback()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN RAISE EXCEPTION 'rating must be between 1 and 5'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_feedback_validate BEFORE INSERT OR UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.validate_feedback();

-- SEED PLANS
INSERT INTO public.plans (code, name, price_monthly, price_yearly, max_branches, sort_order, features) VALUES
('STARTER','Starter',499,4990,1,1,'["1 branch","QR loyalty","Digital stamp cards","Customer CRM","Basic analytics"]'),
('GROWTH','Growth',999,9990,3,2,'["3 branches","Offers","Scratch cards","Digital menu","Advanced analytics"]'),
('PRO','Pro',1999,19990,6,3,'["6 branches","Advanced CRM","Automation","Campaigns","Advanced analytics"]'),
('ENTERPRISE','Enterprise',0,0,999,4,'["Unlimited branches","API access","Franchise management","Dedicated support"]');