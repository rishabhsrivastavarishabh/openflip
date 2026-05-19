
-- 1. broadcast_followers SELECT -> authenticated
DROP POLICY IF EXISTS "Users can view broadcast followers" ON public.broadcast_followers;
CREATE POLICY "Authenticated can view broadcast followers"
ON public.broadcast_followers FOR SELECT TO authenticated USING (true);

-- 2. conversations: remove broadcast public branch
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Authenticated can view broadcast conversations"
ON public.conversations FOR SELECT TO authenticated
USING (is_broadcast = true);

-- 3. highlight_stories + story_highlights -> authenticated
DROP POLICY IF EXISTS "Users can view highlight stories" ON public.highlight_stories;
CREATE POLICY "Authenticated can view highlight stories"
ON public.highlight_stories FOR SELECT TO authenticated USING (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='story_highlights') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Story highlights are viewable by everyone" ON public.story_highlights';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view story highlights" ON public.story_highlights';
  END IF;
END$$;
CREATE POLICY "Authenticated can view story highlights"
ON public.story_highlights FOR SELECT TO authenticated USING (true);

-- 4. post_hashtags -> authenticated
DROP POLICY IF EXISTS "Post hashtags are viewable by everyone" ON public.post_hashtags;
CREATE POLICY "Authenticated can view post hashtags"
ON public.post_hashtags FOR SELECT TO authenticated USING (true);

-- 5. reel_likes -> authenticated
DROP POLICY IF EXISTS "Reel likes are public" ON public.reel_likes;
CREATE POLICY "Authenticated can view reel likes"
ON public.reel_likes FOR SELECT TO authenticated USING (true);

-- 6. reels -> authenticated
DROP POLICY IF EXISTS "Reels are public" ON public.reels;
CREATE POLICY "Authenticated can view reels"
ON public.reels FOR SELECT TO authenticated USING (true);

-- 7. user_online_status -> authenticated
DROP POLICY IF EXISTS "User online status is viewable by everyone" ON public.user_online_status;
DROP POLICY IF EXISTS "Anyone can view online status" ON public.user_online_status;
CREATE POLICY "Authenticated can view online status"
ON public.user_online_status FOR SELECT TO authenticated USING (true);

-- 8. Media bucket upload ownership
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
CREATE POLICY "Users can upload to own media folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 9. Profile sensitive columns: revoke direct column SELECT; owners read via get_my_private_profile RPC
REVOKE SELECT (phone_number, date_of_birth, gender, business_email, country_code)
  ON public.profiles FROM anon, authenticated;

-- 10. verification_requests admin SELECT
CREATE POLICY "Admins can view verification requests"
ON public.verification_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
