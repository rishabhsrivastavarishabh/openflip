DROP POLICY IF EXISTS "Users can create subscriptions" ON public.creator_subscriptions;

CREATE POLICY "Users can create pending subscriptions"
ON public.creator_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = subscriber_id
  AND status = 'pending'
  AND (expires_at IS NULL OR expires_at <= now() + interval '1 day')
);