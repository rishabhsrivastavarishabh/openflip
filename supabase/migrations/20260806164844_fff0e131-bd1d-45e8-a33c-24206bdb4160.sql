
-- Brand Marketplace
CREATE TABLE public.brand_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  budget_min NUMERIC NOT NULL DEFAULT 0,
  budget_max NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  deliverables TEXT NOT NULL DEFAULT '',
  requirements TEXT,
  min_followers INTEGER NOT NULL DEFAULT 0,
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_deals TO authenticated;
GRANT ALL ON public.brand_deals TO service_role;
ALTER TABLE public.brand_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can browse open deals" ON public.brand_deals
  FOR SELECT TO authenticated USING (status = 'open' OR brand_id = auth.uid());
CREATE POLICY "Brands create their own deals" ON public.brand_deals
  FOR INSERT TO authenticated WITH CHECK (brand_id = auth.uid());
CREATE POLICY "Brands update their own deals" ON public.brand_deals
  FOR UPDATE TO authenticated USING (brand_id = auth.uid()) WITH CHECK (brand_id = auth.uid());
CREATE POLICY "Brands delete their own deals" ON public.brand_deals
  FOR DELETE TO authenticated USING (brand_id = auth.uid());
CREATE TRIGGER trg_brand_deals_updated_at BEFORE UPDATE ON public.brand_deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.deal_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.brand_deals(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL DEFAULT '',
  proposed_rate NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, creator_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_applications TO authenticated;
GRANT ALL ON public.deal_applications TO service_role;
ALTER TABLE public.deal_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators and deal owners can view applications" ON public.deal_applications
  FOR SELECT TO authenticated USING (
    creator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.brand_deals d WHERE d.id = deal_id AND d.brand_id = auth.uid())
  );
CREATE POLICY "Creators apply for themselves" ON public.deal_applications
  FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid() AND status = 'pending');
CREATE POLICY "Creators withdraw their own application" ON public.deal_applications
  FOR DELETE TO authenticated USING (creator_id = auth.uid());
CREATE POLICY "Deal owners decide on applications" ON public.deal_applications
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.brand_deals d WHERE d.id = deal_id AND d.brand_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.brand_deals d WHERE d.id = deal_id AND d.brand_id = auth.uid())
  );
CREATE TRIGGER trg_deal_applications_updated_at BEFORE UPDATE ON public.deal_applications
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Developer platform
CREATE TABLE public.developer_apps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  website_url TEXT,
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  environment TEXT NOT NULL DEFAULT 'sandbox',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_apps TO authenticated;
GRANT ALL ON public.developer_apps TO service_role;
ALTER TABLE public.developer_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their apps" ON public.developer_apps
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_developer_apps_updated_at BEFORE UPDATE ON public.developer_apps
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID REFERENCES public.developer_apps(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Default key',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{profile:read}',
  environment TEXT NOT NULL DEFAULT 'sandbox',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their api keys" ON public.api_keys
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.webhook_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id UUID REFERENCES public.developer_apps(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  signing_secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their webhooks" ON public.webhook_endpoints
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_webhook_endpoints_updated_at BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.webhook_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  status_code INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their webhook deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.webhook_endpoints w WHERE w.id = endpoint_id AND w.user_id = auth.uid())
  );
