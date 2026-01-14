-- Add group chat and broadcast channel support to conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS is_group boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS group_name text,
ADD COLUMN IF NOT EXISTS group_avatar_url text,
ADD COLUMN IF NOT EXISTS created_by uuid,
ADD COLUMN IF NOT EXISTS is_broadcast boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS broadcast_description text,
ADD COLUMN IF NOT EXISTS disappearing_messages_timer integer; -- null = disabled, values: 24, 168 (7 days), 720 (30 days) in hours

-- Add admin role and disappearing message support to conversation participants
ALTER TABLE public.conversation_participants
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS can_post boolean DEFAULT true; -- For broadcast channels

-- Add disappearing messages expiration to messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS story_reply_preview_url text;

-- Create broadcast channel followers table
CREATE TABLE IF NOT EXISTS public.broadcast_followers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  followed_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Enable RLS on broadcast_followers
ALTER TABLE public.broadcast_followers ENABLE ROW LEVEL SECURITY;

-- RLS policies for broadcast_followers
CREATE POLICY "Users can view broadcast followers" ON public.broadcast_followers
  FOR SELECT USING (true);

CREATE POLICY "Users can follow broadcasts" ON public.broadcast_followers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow broadcasts" ON public.broadcast_followers
  FOR DELETE USING (auth.uid() = user_id);

-- Update conversations RLS policies for group support
CREATE POLICY "Users can view their conversations" ON public.conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = id AND user_id = auth.uid()
    )
    OR
    (is_broadcast = true)
  );

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Participants can update conversations" ON public.conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = id AND user_id = auth.uid()
    )
  );

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_is_group ON public.conversations(is_group) WHERE is_group = true;
CREATE INDEX IF NOT EXISTS idx_conversations_is_broadcast ON public.conversations(is_broadcast) WHERE is_broadcast = true;
CREATE INDEX IF NOT EXISTS idx_messages_expires_at ON public.messages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_broadcast_followers_channel ON public.broadcast_followers(channel_id);

-- Enable realtime for broadcast_followers
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_followers;