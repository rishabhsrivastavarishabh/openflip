
-- Server-side push dispatch for new messages: fires for every recipient in the
-- conversation, so background/OS notifications are delivered even when the
-- sender's tab is closed.
CREATE OR REPLACE FUNCTION public.messages_push_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  service_key    text;
  sender_username text;
  sender_avatar   text;
  rec RECORD;
  preview_text    text;
BEGIN
  IF NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';
  IF service_key IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT username, avatar_url INTO sender_username, sender_avatar
  FROM public.profiles WHERE id = NEW.sender_id;

  preview_text := CASE
    WHEN COALESCE(NEW.is_encrypted, false) THEN '🔒 New encrypted message'
    WHEN NEW.content IS NOT NULL AND length(NEW.content) > 0
      THEN left(NEW.content, 120)
    WHEN NEW.media_url IS NOT NULL THEN '📎 Sent an attachment'
    ELSE 'Tap to view'
  END;

  FOR rec IN
    SELECT cp.user_id
    FROM public.conversation_participants cp
    LEFT JOIN public.notification_settings ns ON ns.user_id = cp.user_id
    WHERE cp.conversation_id = NEW.conversation_id
      AND cp.user_id <> NEW.sender_id
      AND COALESCE(ns.chat_notifications, true) = true
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := 'https://rbgwfkmirxgsktwejlig.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object(
          'user_id', rec.user_id,
          'title', COALESCE(sender_username, 'New message'),
          'body', preview_text,
          'type', 'message',
          'tag', 'conv-' || NEW.conversation_id::text,
          'icon', sender_avatar,
          'data', jsonb_build_object(
            'url', '/messages/' || NEW.conversation_id::text,
            'conversationId', NEW.conversation_id
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'messages_push_dispatch failed for user %: %', rec.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'messages_push_dispatch outer failure: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_push_dispatch ON public.messages;
CREATE TRIGGER trg_messages_push_dispatch
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.messages_push_dispatch();
