-- Fix the infinite recursion in conversation_participants RLS policy
-- by creating a security definer function

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view participants of own conversations" ON public.conversation_participants;

-- Create a security definer function to check conversation participation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

-- Create a new non-recursive policy for viewing participants
CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
);

-- Also add DELETE policy for conversation participants (needed for leaving groups)
CREATE POLICY "Users can leave conversations"
ON public.conversation_participants
FOR DELETE
USING (auth.uid() = user_id);

-- Fix admin update policy for group settings
CREATE POLICY "Admins can update participant settings"
ON public.conversation_participants
FOR UPDATE
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
      AND cp.user_id = auth.uid()
      AND cp.is_admin = true
  )
);