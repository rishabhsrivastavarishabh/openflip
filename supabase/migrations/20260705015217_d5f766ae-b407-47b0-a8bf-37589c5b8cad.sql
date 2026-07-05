
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS group_description text,
  ADD COLUMN IF NOT EXISTS only_admins_can_message boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS only_admins_can_edit_info boolean NOT NULL DEFAULT false;
