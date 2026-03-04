
-- Add story visibility column to stories
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

-- Add allow_replies and allow_reactions columns to stories
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS allow_replies boolean DEFAULT true;
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS allow_reactions boolean DEFAULT true;

-- Create close_friends table
CREATE TABLE IF NOT EXISTS public.close_friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their close friends list"
ON public.close_friends FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add post collaboration columns
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS collaborator_id uuid;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS collaboration_status text DEFAULT 'none';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments_enabled boolean DEFAULT true;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS likes_enabled boolean DEFAULT true;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS sharing_enabled boolean DEFAULT true;

-- Add verification document fields
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS document_url text;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS document_type text;
ALTER TABLE public.verification_requests ADD COLUMN IF NOT EXISTS government_id_url text;
