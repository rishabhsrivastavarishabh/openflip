ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'everyone';
CREATE OR REPLACE FUNCTION public.validate_post_audience() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.audience NOT IN ('everyone','followers') THEN RAISE EXCEPTION 'Invalid audience'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_post_audience ON public.posts;
CREATE TRIGGER trg_validate_post_audience BEFORE INSERT OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.validate_post_audience();
DROP POLICY IF EXISTS "Posts are viewable based on privacy" ON public.posts;
CREATE POLICY "Posts are viewable based on privacy" ON public.posts FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.follows f WHERE f.following_id = posts.user_id AND f.follower_id = auth.uid())
  OR (posts.audience = 'everyone' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = posts.user_id AND COALESCE(p.is_private,false) = false))
);