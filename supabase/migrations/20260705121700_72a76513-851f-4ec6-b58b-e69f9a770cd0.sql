ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS call_ringtone text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS caller_tune text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS caller_tune_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS message_ringtone text NOT NULL DEFAULT 'chime',
  ADD COLUMN IF NOT EXISTS call_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS video_call_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS call_vibrate boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS speaker_default_on boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_unknown_callers boolean NOT NULL DEFAULT true;