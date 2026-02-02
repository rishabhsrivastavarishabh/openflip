-- Add message reactions table
CREATE TABLE public.message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add unique constraint for one reaction per emoji per user per message
CREATE UNIQUE INDEX unique_message_reaction ON public.message_reactions(message_id, user_id, emoji);

-- Enable RLS
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for message reactions
CREATE POLICY "Users can view reactions in their conversations"
ON public.message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add reactions to messages in their conversations"
ON public.message_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE m.id = message_reactions.message_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove their own reactions"
ON public.message_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Add reply_to_id column to messages for quote/reply functionality
ALTER TABLE public.messages ADD COLUMN reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Add file_name column for file attachments
ALTER TABLE public.messages ADD COLUMN file_name TEXT;

-- Add file_size column for file attachments
ALTER TABLE public.messages ADD COLUMN file_size BIGINT;

-- Add status columns for message delivery tracking
ALTER TABLE public.messages ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.messages ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.messages ADD COLUMN status TEXT DEFAULT 'sent';

-- Enable realtime for messages and message_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;