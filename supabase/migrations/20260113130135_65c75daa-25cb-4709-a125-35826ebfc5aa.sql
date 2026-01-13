-- Add business account fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'personal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_category text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_website text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz;

-- Create verification requests table
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  category text NOT NULL,
  business_name text,
  business_email text,
  notes text,
  reviewed_by UUID,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification requests" 
ON public.verification_requests FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create verification requests" 
ON public.verification_requests FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add media message fields to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_type text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS voice_duration integer;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_view_once boolean DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS viewed_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS shared_post_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS shared_reel_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS shared_profile_id UUID;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS story_id UUID;

-- Create index for view once messages
CREATE INDEX IF NOT EXISTS idx_messages_view_once ON public.messages(is_view_once) WHERE is_view_once = true;