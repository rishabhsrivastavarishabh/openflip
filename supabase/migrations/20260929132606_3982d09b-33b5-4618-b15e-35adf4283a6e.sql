DROP POLICY IF EXISTS "Authenticated can view reels" ON public.reels;
CREATE POLICY "Public reels viewable; private reels for owner and followers"
ON public.reels FOR SELECT TO authenticated
USING (public.can_view_profile_content(user_id));

DROP POLICY IF EXISTS "Authenticated can view reel likes" ON public.reel_likes;
CREATE POLICY "Reel likes visible when the reel is visible"
ON public.reel_likes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.reels r
    WHERE r.id = reel_id
      AND public.can_view_profile_content(r.user_id)
  )
);

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Public profiles viewable; private profiles for owner and followers"
ON public.profiles FOR SELECT TO authenticated
USING (
  COALESCE(is_private, false) = false
  OR id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.follows f
    WHERE f.follower_id = auth.uid() AND f.following_id = profiles.id
  )
);