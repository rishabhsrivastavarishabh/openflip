ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_conv_participants_pinned ON public.conversation_participants(user_id, is_pinned) WHERE is_pinned = true;