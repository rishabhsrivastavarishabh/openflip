
-- 1) notifications: require actor_id = auth.uid() on insert
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Users can create notifications as themselves"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = actor_id);

-- 2) story_highlights: remove anon-readable policy
DROP POLICY IF EXISTS "Users can view any highlights" ON public.story_highlights;

-- 3) user_online_status: remove anon-readable policy
DROP POLICY IF EXISTS "Users can view any online status" ON public.user_online_status;
