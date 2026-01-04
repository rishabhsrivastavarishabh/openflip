-- Create follow_requests table for private profile follow requests
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  target_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(requester_id, target_id)
);

-- Enable RLS
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for follow_requests
CREATE POLICY "Users can view their own sent requests"
ON public.follow_requests FOR SELECT
USING (auth.uid() = requester_id);

CREATE POLICY "Users can view requests sent to them"
ON public.follow_requests FOR SELECT
USING (auth.uid() = target_id);

CREATE POLICY "Users can create follow requests"
ON public.follow_requests FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Target users can update request status"
ON public.follow_requests FOR UPDATE
USING (auth.uid() = target_id);

CREATE POLICY "Requesters can delete their own requests"
ON public.follow_requests FOR DELETE
USING (auth.uid() = requester_id);

CREATE POLICY "Target can delete requests"
ON public.follow_requests FOR DELETE
USING (auth.uid() = target_id);

-- Add trigger for updated_at
CREATE TRIGGER update_follow_requests_updated_at
BEFORE UPDATE ON public.follow_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Update posts RLS to respect private profiles
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;

CREATE POLICY "Posts are viewable based on privacy"
ON public.posts FOR SELECT
USING (
  -- Public profiles: everyone can see
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = posts.user_id 
    AND (profiles.is_private = false OR profiles.is_private IS NULL)
  )
  OR
  -- Private profiles: only approved followers can see
  EXISTS (
    SELECT 1 FROM follows 
    WHERE follows.following_id = posts.user_id 
    AND follows.follower_id = auth.uid()
  )
  OR
  -- Own posts
  auth.uid() = posts.user_id
);

-- Update notifications to include follow_request type
-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON public.follow_requests(target_id);
CREATE INDEX IF NOT EXISTS idx_follow_requests_requester ON public.follow_requests(requester_id);

-- Enable realtime for follow_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_requests;