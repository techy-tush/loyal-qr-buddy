CREATE TABLE public.platform_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read platform settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert platform settings" ON public.platform_settings FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "Admins update platform settings" ON public.platform_settings FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
INSERT INTO public.platform_settings (key, value) VALUES ('upi_id', ''), ('upi_payee_name', 'Digital Udyam');

ALTER TABLE public.payments ADD COLUMN plan_id uuid REFERENCES public.plans(id), ADD COLUMN cycle text;
CREATE INDEX IF NOT EXISTS businesses_city_idx ON public.businesses (lower(city));