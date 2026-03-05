
-- Creator fan subscriptions table
CREATE TABLE public.creator_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  subscriber_id UUID NOT NULL,
  tier TEXT NOT NULL DEFAULT 'basic',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(creator_id, subscriber_id)
);

-- Creator subscription settings
CREATE TABLE public.creator_subscription_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  monthly_price NUMERIC NOT NULL DEFAULT 49,
  yearly_price NUMERIC NOT NULL DEFAULT 490,
  currency TEXT NOT NULL DEFAULT 'INR',
  benefits JSONB DEFAULT '["Exclusive posts", "Exclusive reels", "Subscriber-only stories", "Badge on comments"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_subscription_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for creator_subscriptions
CREATE POLICY "Users can view their own subscriptions" ON public.creator_subscriptions FOR SELECT USING (auth.uid() = subscriber_id OR auth.uid() = creator_id);
CREATE POLICY "Users can create subscriptions" ON public.creator_subscriptions FOR INSERT WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY "Users can update their own subscriptions" ON public.creator_subscriptions FOR UPDATE USING (auth.uid() = subscriber_id OR auth.uid() = creator_id);

-- RLS policies for creator_subscription_settings
CREATE POLICY "Anyone can view settings" ON public.creator_subscription_settings FOR SELECT USING (true);
CREATE POLICY "Users can manage their own settings" ON public.creator_subscription_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON public.creator_subscription_settings FOR UPDATE USING (auth.uid() = user_id);
