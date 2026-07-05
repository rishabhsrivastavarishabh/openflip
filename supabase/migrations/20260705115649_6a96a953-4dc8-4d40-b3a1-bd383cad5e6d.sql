-- Trigger: dispatch a web-push OS notification when a new row lands in public.notifications.
-- Runs asynchronously via pg_net; failures never abort the originating insert.

CREATE OR REPLACE FUNCTION public.notifications_push_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  actor_username text;
  actor_avatar   text;
  settings_row   public.notification_settings%ROWTYPE;
  allow          boolean := true;
  title_text     text;
  body_text      text;
  url_path       text := '/notifications';
  service_key    text;
BEGIN
  -- Skip if recipient == actor (self-notifications shouldn't buzz the phone).
  IF NEW.actor_id IS NOT NULL AND NEW.actor_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Messages already dispatch push from the sender client; avoid duplicates.
  IF NEW.type IN ('message', 'message_request') THEN
    RETURN NEW;
  END IF;

  -- Honor per-user notification settings.
  SELECT * INTO settings_row FROM public.notification_settings WHERE user_id = NEW.user_id;
  IF FOUND THEN
    CASE NEW.type
      WHEN 'like'            THEN allow := COALESCE(settings_row.like_notifications, true);
      WHEN 'comment'         THEN allow := COALESCE(settings_row.comment_notifications, true);
      WHEN 'follow'          THEN allow := COALESCE(settings_row.follow_notifications, true);
      WHEN 'follow_request'  THEN allow := COALESCE(settings_row.follow_notifications, true);
      WHEN 'follow_accepted' THEN allow := COALESCE(settings_row.follow_notifications, true);
      WHEN 'story_reaction'  THEN allow := COALESCE(settings_row.story_like_notifications, true);
      WHEN 'story_reply'     THEN allow := COALESCE(settings_row.story_like_notifications, true);
      ELSE allow := true;
    END CASE;
  END IF;
  IF NOT allow THEN
    RETURN NEW;
  END IF;

  -- Look up the actor for title/icon.
  IF NEW.actor_id IS NOT NULL THEN
    SELECT username, avatar_url INTO actor_username, actor_avatar
    FROM public.profiles WHERE id = NEW.actor_id;
  END IF;

  title_text := COALESCE(actor_username, 'Openflip');
  body_text := CASE NEW.type
    WHEN 'like'            THEN 'liked your post'
    WHEN 'comment'         THEN 'commented on your post'
    WHEN 'follow'          THEN 'started following you'
    WHEN 'follow_request'  THEN 'requested to follow you'
    WHEN 'follow_accepted' THEN 'accepted your follow request'
    WHEN 'mention'         THEN 'mentioned you'
    WHEN 'story_reply'     THEN 'replied to your story'
    WHEN 'story_reaction'  THEN 'reacted to your story'
    WHEN 'tip'             THEN 'sent you a tip'
    WHEN 'subscription'    THEN 'subscribed to you'
    ELSE 'sent you a notification'
  END;

  -- Reuse the service-role key already vaulted for the email queue.
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key';

  IF service_key IS NULL THEN
    RETURN NEW; -- No key wired yet; skip silently.
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := 'https://rbgwfkmirxgsktwejlig.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', title_text,
        'body', body_text,
        'type', NEW.type,
        'tag', 'notif-' || NEW.id::text,
        'icon', actor_avatar,
        'data', jsonb_build_object('url', url_path, 'notificationId', NEW.id)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notifications_push_dispatch failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_push_dispatch ON public.notifications;
CREATE TRIGGER trg_notifications_push_dispatch
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.notifications_push_dispatch();