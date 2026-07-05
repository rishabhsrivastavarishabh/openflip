
CREATE TYPE public.moderation_entity AS ENUM ('campaign', 'subscription', 'payout');
CREATE TYPE public.moderation_action AS ENUM ('reviewed', 'investigate');

CREATE TABLE public.moderation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.moderation_entity NOT NULL,
  entity_id uuid NOT NULL,
  action public.moderation_action NOT NULL,
  note text,
  reviewed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX moderation_reviews_entity_idx
  ON public.moderation_reviews (entity_type, entity_id, reviewed_at DESC);

GRANT SELECT, INSERT ON public.moderation_reviews TO authenticated;
GRANT ALL ON public.moderation_reviews TO service_role;

ALTER TABLE public.moderation_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view moderation reviews"
  ON public.moderation_reviews
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create moderation reviews"
  ON public.moderation_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND reviewed_by = auth.uid()
  );
