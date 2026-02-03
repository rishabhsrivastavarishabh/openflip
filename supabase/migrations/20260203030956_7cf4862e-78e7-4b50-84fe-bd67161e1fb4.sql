-- Create subscription plans table
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_monthly integer NOT NULL, -- in cents
  price_yearly integer NOT NULL, -- in cents
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user subscriptions table
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  stripe_subscription_id text,
  stripe_customer_id text,
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'cancelled', 'past_due', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create payment history table
CREATE TABLE public.payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.user_subscriptions(id),
  stripe_payment_intent_id text,
  amount integer NOT NULL, -- in cents
  currency text DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  description text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Subscription plans are viewable by everyone
CREATE POLICY "Subscription plans are viewable by everyone"
ON public.subscription_plans FOR SELECT
USING (true);

-- Only admins can manage subscription plans
CREATE POLICY "Admins can manage subscription plans"
ON public.subscription_plans FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Users can view their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.user_subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can insert their own subscriptions"
ON public.user_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscriptions
CREATE POLICY "Users can update their own subscriptions"
ON public.user_subscriptions FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
ON public.user_subscriptions FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update all subscriptions
CREATE POLICY "Admins can update all subscriptions"
ON public.user_subscriptions FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Users can view their own payment history
CREATE POLICY "Users can view their own payment history"
ON public.payment_history FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all payment history
CREATE POLICY "Admins can view all payment history"
ON public.payment_history FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Insert default subscription plan
INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, features)
VALUES (
  'Openflip Verified',
  'Get verified and unlock premium features',
  999, -- $9.99/month
  7999, -- $79.99/year (save ~33%)
  '["Verified badge (✓)", "Priority in search results", "Higher visibility in feed & reels", "Access to creator tools", "Business analytics", "Priority support"]'::jsonb
);

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = check_user_id
      AND status = 'active'
      AND current_period_end > now()
  )
$$;

-- Trigger to update is_verified based on subscription status
CREATE OR REPLACE FUNCTION public.sync_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update the profile's is_verified status based on subscription
  IF NEW.status = 'active' AND NEW.current_period_end > now() THEN
    UPDATE public.profiles SET is_verified = true WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles SET is_verified = false WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_verification_on_subscription_change
AFTER INSERT OR UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_verification_status();