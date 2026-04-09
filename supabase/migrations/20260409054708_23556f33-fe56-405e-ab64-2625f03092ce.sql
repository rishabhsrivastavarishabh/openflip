-- Create devices table for E2EE public key storage
CREATE TABLE public.devices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  device_name text NOT NULL DEFAULT 'Web Browser',
  device_public_key text NOT NULL,
  signed_prekey_public text,
  prekey_bundle jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own devices"
ON public.devices FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read device public keys"
ON public.devices FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_devices_user_id ON public.devices(user_id);

-- Create message_receipts table
CREATE TABLE public.message_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  delivered_at timestamp with time zone,
  seen_at timestamp with time zone
);

ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view receipts"
ON public.message_receipts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE m.id = message_receipts.message_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Participants can create receipts"
ON public.message_receipts FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
    WHERE m.id = message_receipts.message_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own receipts"
ON public.message_receipts FOR UPDATE
USING (auth.uid() = user_id);

CREATE INDEX idx_message_receipts_message_id ON public.message_receipts(message_id);
CREATE UNIQUE INDEX idx_message_receipts_unique ON public.message_receipts(message_id, user_id);

-- Add E2EE columns to messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS ciphertext text,
  ADD COLUMN IF NOT EXISTS nonce text,
  ADD COLUMN IF NOT EXISTS aad text,
  ADD COLUMN IF NOT EXISTS sender_device_id uuid REFERENCES public.devices(id),
  ADD COLUMN IF NOT EXISTS is_encrypted boolean DEFAULT false;

-- Enable realtime for message_receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts;
