
-- Fan-out per-device encrypted copies so a message sent by one device can be
-- decrypted on every other signed-in device of the same user (and on every
-- signed-in device of the recipient), not just the primary target device.
CREATE TABLE IF NOT EXISTS public.message_device_keys (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  recipient_device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  aad TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, recipient_device_id)
);

GRANT SELECT, INSERT, DELETE ON public.message_device_keys TO authenticated;
GRANT ALL ON public.message_device_keys TO service_role;

ALTER TABLE public.message_device_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipient device owner can select" ON public.message_device_keys;
CREATE POLICY "recipient device owner can select"
  ON public.message_device_keys
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = recipient_device_id AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sender can insert own copies" ON public.message_device_keys;
CREATE POLICY "sender can insert own copies"
  ON public.message_device_keys
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.sender_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sender can delete own copies" ON public.message_device_keys;
CREATE POLICY "sender can delete own copies"
  ON public.message_device_keys
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.sender_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_mdk_message ON public.message_device_keys(message_id);
CREATE INDEX IF NOT EXISTS idx_mdk_device ON public.message_device_keys(recipient_device_id);

-- Return every active device's public key for a user so senders can fan-out
-- one encrypted blob per device (SECURITY DEFINER avoids exposing the devices
-- table for direct read).
CREATE OR REPLACE FUNCTION public.get_all_recipient_device_keys(_user_id uuid)
RETURNS TABLE(id uuid, device_public_key text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, device_public_key
  FROM public.devices
  WHERE user_id = _user_id
  ORDER BY last_seen_at DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_recipient_device_keys(uuid) TO authenticated;
