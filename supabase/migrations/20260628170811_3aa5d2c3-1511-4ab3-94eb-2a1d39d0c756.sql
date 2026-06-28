
DROP POLICY IF EXISTS "Users can follow broadcasts" ON public.broadcast_followers;
DROP POLICY IF EXISTS "Users can unfollow broadcasts" ON public.broadcast_followers;

CREATE POLICY "Users can follow broadcasts"
  ON public.broadcast_followers
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unfollow broadcasts"
  ON public.broadcast_followers
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
