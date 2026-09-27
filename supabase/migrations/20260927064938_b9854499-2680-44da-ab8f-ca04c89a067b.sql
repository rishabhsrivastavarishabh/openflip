CREATE OR REPLACE FUNCTION public.can_view_profile_content(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = _owner AND COALESCE(is_private,false) = false)
    OR EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = _owner)
$$;

DROP POLICY IF EXISTS "Authenticated users can view follows" ON public.follows;
CREATE POLICY "View follows of visible profiles" ON public.follows FOR SELECT TO authenticated
USING (
  auth.uid() = follower_id OR auth.uid() = following_id
  OR (public.can_view_profile_content(follower_id) AND public.can_view_profile_content(following_id))
);

DROP POLICY IF EXISTS "Authenticated can view broadcast followers" ON public.broadcast_followers;
CREATE POLICY "View own or owned channel broadcast follows" ON public.broadcast_followers FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = channel_id AND c.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated can view story highlights" ON public.story_highlights;
CREATE POLICY "View highlights of visible profiles" ON public.story_highlights FOR SELECT TO authenticated
USING (public.can_view_profile_content(user_id));