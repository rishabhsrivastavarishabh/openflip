DROP POLICY IF EXISTS "Authenticated can view online status" ON public.user_online_status;

CREATE POLICY "Users can view relevant online status"
ON public.user_online_status
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = auth.uid()
      AND f.following_id = public.user_online_status.user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.conversation_participants me
    JOIN public.conversation_participants them
      ON them.conversation_id = me.conversation_id
    WHERE me.user_id = auth.uid()
      AND them.user_id = public.user_online_status.user_id
  )
);