-- Promo codes table for discounts
CREATE TABLE public.promo_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  max_uses INTEGER DEFAULT NULL,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  first_time_only BOOLEAN NOT NULL DEFAULT false,
  min_purchase_amount NUMERIC DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Promo code usage tracking
CREATE TABLE public.promo_code_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.user_subscriptions(id),
  discount_applied NUMERIC NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(promo_code_id, user_id)
);

-- Content analytics table for tracking views and engagement
CREATE TABLE public.content_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'reel', 'story')),
  content_id UUID NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  unique_views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  profile_visits INTEGER NOT NULL DEFAULT 0,
  follows_gained INTEGER NOT NULL DEFAULT 0,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(content_id, recorded_at)
);

-- Audience insights for creators
CREATE TABLE public.audience_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  age_range TEXT,
  gender TEXT,
  location TEXT,
  follower_count INTEGER NOT NULL DEFAULT 0,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, age_range, gender, location, recorded_at)
);

-- Creator earnings table
CREATE TABLE public.creator_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  earning_type TEXT NOT NULL CHECK (earning_type IN ('ad', 'promotion', 'subscription', 'boost')),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payout requests
CREATE TABLE public.payout_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  payment_method TEXT,
  payment_details JSONB,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Content boost/promotion campaigns
CREATE TABLE public.boost_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'reel')),
  content_id UUID NOT NULL,
  budget NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  duration_days INTEGER NOT NULL DEFAULT 7,
  target_audience JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'paused')),
  reach_estimate INTEGER,
  actual_reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS Policies for promo_codes
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage promo codes"
  ON public.promo_codes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can read active promo codes"
  ON public.promo_codes FOR SELECT
  USING (is_active = true);

-- RLS for promo_code_usage
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own promo usage"
  ON public.promo_code_usage FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert promo usage"
  ON public.promo_code_usage FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS for content_analytics
ALTER TABLE public.content_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analytics"
  ON public.content_analytics FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can manage analytics"
  ON public.content_analytics FOR ALL
  USING (true);

-- RLS for audience_insights
ALTER TABLE public.audience_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audience insights"
  ON public.audience_insights FOR SELECT
  USING (user_id = auth.uid());

-- RLS for creator_earnings
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own earnings"
  ON public.creator_earnings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage earnings"
  ON public.creator_earnings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS for payout_requests
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and create their own payout requests"
  ON public.payout_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create payout requests"
  ON public.payout_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage payout requests"
  ON public.payout_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS for boost_campaigns
ALTER TABLE public.boost_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own campaigns"
  ON public.boost_campaigns FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all campaigns"
  ON public.boost_campaigns FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Triggers for updated_at
CREATE TRIGGER update_promo_codes_updated_at
  BEFORE UPDATE ON public.promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_content_analytics_updated_at
  BEFORE UPDATE ON public.content_analytics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_creator_earnings_updated_at
  BEFORE UPDATE ON public.creator_earnings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_payout_requests_updated_at
  BEFORE UPDATE ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_boost_campaigns_updated_at
  BEFORE UPDATE ON public.boost_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to validate promo code
CREATE OR REPLACE FUNCTION public.validate_promo_code(code_input TEXT, user_id_input UUID)
RETURNS TABLE (
  is_valid BOOLEAN,
  discount_type TEXT,
  discount_value NUMERIC,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  promo RECORD;
  already_used BOOLEAN;
  is_first_subscription BOOLEAN;
BEGIN
  -- Find the promo code
  SELECT * INTO promo FROM promo_codes WHERE UPPER(code) = UPPER(code_input) AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 'Invalid promo code';
    RETURN;
  END IF;
  
  -- Check expiry
  IF promo.expires_at IS NOT NULL AND promo.expires_at < now() THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 'Promo code has expired';
    RETURN;
  END IF;
  
  -- Check usage limit
  IF promo.max_uses IS NOT NULL AND promo.current_uses >= promo.max_uses THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 'Promo code usage limit reached';
    RETURN;
  END IF;
  
  -- Check if user already used this code
  SELECT EXISTS(SELECT 1 FROM promo_code_usage WHERE promo_code_id = promo.id AND promo_code_usage.user_id = user_id_input) INTO already_used;
  IF already_used THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 'You have already used this promo code';
    RETURN;
  END IF;
  
  -- Check first-time only restriction
  IF promo.first_time_only THEN
    SELECT NOT EXISTS(SELECT 1 FROM user_subscriptions WHERE user_subscriptions.user_id = user_id_input) INTO is_first_subscription;
    IF NOT is_first_subscription THEN
      RETURN QUERY SELECT false, NULL::TEXT, NULL::NUMERIC, 'This code is only valid for first-time subscribers';
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY SELECT true, promo.discount_type, promo.discount_value, NULL::TEXT;
END;
$$;