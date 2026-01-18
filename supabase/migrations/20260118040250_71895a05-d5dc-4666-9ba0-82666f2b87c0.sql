-- Create user_online_status table for WhatsApp-like online presence
CREATE TABLE IF NOT EXISTS public.user_online_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on user_online_status
ALTER TABLE public.user_online_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_online_status
CREATE POLICY "Users can view any online status"
ON public.user_online_status FOR SELECT
USING (true);

CREATE POLICY "Users can update their own online status"
ON public.user_online_status FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own online status record"
ON public.user_online_status FOR UPDATE
USING (auth.uid() = user_id);

-- Enable realtime for online status
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_online_status;