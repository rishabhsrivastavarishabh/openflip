-- Add date_of_birth and gender to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS gender TEXT;

-- Create notification_settings table for user preferences
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  chat_notifications BOOLEAN DEFAULT true,
  story_like_notifications BOOLEAN DEFAULT true,
  comment_notifications BOOLEAN DEFAULT true,
  follow_notifications BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  ringtone TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on notification_settings
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_settings
CREATE POLICY "Users can view their own notification settings"
ON public.notification_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
ON public.notification_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
ON public.notification_settings FOR UPDATE
USING (auth.uid() = user_id);

-- Create story_highlights table if not exists
CREATE TABLE IF NOT EXISTS public.story_highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  cover_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create highlight_stories junction table if not exists
CREATE TABLE IF NOT EXISTS public.highlight_stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  highlight_id UUID NOT NULL REFERENCES public.story_highlights(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(highlight_id, story_id)
);

-- Enable RLS on story_highlights
ALTER TABLE public.story_highlights ENABLE ROW LEVEL SECURITY;

-- RLS policies for story_highlights
CREATE POLICY "Users can view any highlights"
ON public.story_highlights FOR SELECT
USING (true);

CREATE POLICY "Users can create their own highlights"
ON public.story_highlights FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own highlights"
ON public.story_highlights FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own highlights"
ON public.story_highlights FOR DELETE
USING (auth.uid() = user_id);

-- Enable RLS on highlight_stories
ALTER TABLE public.highlight_stories ENABLE ROW LEVEL SECURITY;

-- RLS policies for highlight_stories
CREATE POLICY "Users can view highlight stories"
ON public.highlight_stories FOR SELECT
USING (true);

CREATE POLICY "Users can manage their highlight stories"
ON public.highlight_stories FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.story_highlights
    WHERE id = highlight_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their highlight stories"
ON public.highlight_stories FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.story_highlights
    WHERE id = highlight_id AND user_id = auth.uid()
  )
);

-- Create chat_disabled table for WhatsApp-like disable feature
CREATE TABLE IF NOT EXISTS public.chat_disabled (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  disabled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS on chat_disabled
ALTER TABLE public.chat_disabled ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_disabled
CREATE POLICY "Users can view their disabled chats"
ON public.chat_disabled FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can disable chats"
ON public.chat_disabled FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can enable chats"
ON public.chat_disabled FOR DELETE
USING (auth.uid() = user_id);