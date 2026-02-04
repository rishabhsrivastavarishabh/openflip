-- Fix overly permissive RLS policy on content_analytics
DROP POLICY IF EXISTS "System can manage analytics" ON public.content_analytics;

-- More restrictive policy - only the user can insert/update their own analytics
CREATE POLICY "Users can manage their own analytics"
  ON public.content_analytics FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());