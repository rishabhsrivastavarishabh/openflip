-- Push subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

-- Calls
CREATE TYPE public.call_type AS ENUM ('voice', 'video');
CREATE TYPE public.call_status AS ENUM ('ringing', 'accepted', 'declined', 'missed', 'ended', 'cancelled');

CREATE TABLE public.calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  call_type public.call_type NOT NULL DEFAULT 'voice',
  status public.call_status NOT NULL DEFAULT 'ringing',
  offer JSONB,
  answer JSONB,
  ice_candidates JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calls they participate in"
  ON public.calls FOR SELECT
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Users can create outgoing calls"
  ON public.calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Participants can update call status"
  ON public.calls FOR UPDATE
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id)
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE INDEX idx_calls_callee_status ON public.calls(callee_id, status);
CREATE INDEX idx_calls_caller ON public.calls(caller_id);

CREATE TRIGGER trg_calls_updated_at
  BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_push_subs_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Realtime
ALTER TABLE public.calls REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;