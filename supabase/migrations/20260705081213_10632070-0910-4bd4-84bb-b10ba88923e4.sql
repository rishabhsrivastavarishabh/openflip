
-- 1. boost_campaigns: split ALL into per-op with WITH CHECK preventing status escalation
DROP POLICY IF EXISTS "Users can manage their own campaigns" ON public.boost_campaigns;

CREATE POLICY "Users can view their own campaigns"
  ON public.boost_campaigns
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own campaigns"
  ON public.boost_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('draft', 'pending', 'pending_review')
  );

CREATE POLICY "Users can update their own campaigns (non-privileged fields)"
  ON public.boost_campaigns
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('draft', 'pending', 'pending_review', 'paused', 'cancelled')
  );

CREATE POLICY "Users can delete their own campaigns"
  ON public.boost_campaigns
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 2. conversations: bind created_by to auth.uid() on INSERT
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create conversations"
  ON public.conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 3. creator_subscriptions: remove self-update; only admins/service_role can mutate
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON public.creator_subscriptions;

-- 4. payout_requests: force status='pending' and amount > 0 on insert
DROP POLICY IF EXISTS "Users can create payout requests" ON public.payout_requests;

CREATE POLICY "Users can create payout requests"
  ON public.payout_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND amount > 0
    AND processed_at IS NULL
  );
