ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'everyone';
DROP TRIGGER IF EXISTS trg_validate_reel_audience ON public.reels;
CREATE TRIGGER trg_validate_reel_audience BEFORE INSERT OR UPDATE ON public.reels FOR EACH ROW EXECUTE FUNCTION public.validate_post_audience();
DROP POLICY IF EXISTS "Public reels viewable; private reels for owner and followers" ON public.reels;
CREATE POLICY "Public reels viewable; private reels for owner and followers" ON public.reels FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.follows f WHERE f.following_id = reels.user_id AND f.follower_id = auth.uid())
  OR (reels.audience = 'everyone' AND public.can_view_profile_content(user_id))
);