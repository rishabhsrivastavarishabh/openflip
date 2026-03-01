
-- Enable realtime for additional tables (messages already enabled)
DO $$
BEGIN
  -- Add conversation_participants if not already member
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  -- Add user_online_status if not already member
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_online_status;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  
  -- Add conversations if not already member
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Allow users to update message read status (needed for seen ticks)
CREATE POLICY "Users can update read status of messages in their conversations"
ON public.messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = messages.conversation_id
    AND conversation_participants.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = messages.conversation_id
    AND conversation_participants.user_id = auth.uid()
  )
);

-- Insert 5 subscription plans
INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, features, is_active)
VALUES
  ('Free', 'Basic access to Openflip', 0, 0, '["Basic feed access", "Post photos & videos", "Follow & like", "Direct messaging", "5 posts per day"]'::jsonb, true),
  ('Starter', 'Get started with creator features', 49, 399, '["Everything in Free", "Basic analytics", "10 posts per day", "Story highlights", "1 boost per month", "Priority feed placement"]'::jsonb, true),
  ('Creator', 'Full creator toolkit', 99, 799, '["Everything in Starter", "Verified badge ✓", "Advanced analytics", "Unlimited posts", "3 boosts per month", "Audience insights", "Content calendar", "Hashtag suggestions"]'::jsonb, true),
  ('Pro', 'Professional tools for growth', 199, 1599, '["Everything in Creator", "Real-time analytics", "10 boosts per month", "Earnings dashboard", "Promotion manager", "Best posting time AI", "Reel growth insights", "Priority support"]'::jsonb, true),
  ('Premium Verified', 'Ultimate premium experience', 499, 3999, '["Everything in Pro", "Gold verified badge", "Unlimited boosts", "Creator storefront", "AI growth assistant", "Dedicated account manager", "Early access to features", "Revenue sharing program"]'::jsonb, true)
ON CONFLICT DO NOTHING;
