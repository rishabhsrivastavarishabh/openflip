CREATE OR REPLACE FUNCTION public.get_message_sender_device_public_key(_message_id uuid)
RETURNS TABLE (device_public_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.device_public_key
  FROM public.messages m
  JOIN public.devices d ON d.id = m.sender_device_id
  WHERE m.id = _message_id
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = m.conversation_id
        AND cp.user_id = auth.uid()
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_message_sender_device_public_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_message_sender_device_public_key(uuid) TO authenticated;