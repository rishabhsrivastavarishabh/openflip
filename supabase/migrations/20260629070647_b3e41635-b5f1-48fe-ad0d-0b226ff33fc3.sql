CREATE POLICY "Creators can view their conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (created_by = auth.uid());