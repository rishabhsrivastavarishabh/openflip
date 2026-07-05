import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  isWebPushSupported,
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
} from '@/lib/webPush';
import { getActiveConversation, isDocumentVisible } from '@/hooks/useActiveConversation';

export function usePushNotifications() {
  const { user } = useAuth();

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const perm = await requestNotificationPermission();
    return perm === 'granted';
  }, []);

  const showNotification = useCallback(
    async (title: string, options?: NotificationOptions) => {
      if (Notification.permission !== 'granted') return null;
      // Prefer showing via the service worker so notifications persist and can
      // include actions; fall back to the constructor for older browsers.
      const reg = 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration('/sw.js')
        : null;
      const opts: NotificationOptions = {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      };
      if (reg) {
        await reg.showNotification(title, opts);
        return null;
      }
      const n = new Notification(title, opts);
      n.onclick = () => {
        window.focus();
        n.close();
      };
      return n;
    },
    [],
  );

  // Bootstrap: register SW, request permission, subscribe.
  useEffect(() => {
    if (!user) return;
    (async () => {
      if (!isWebPushSupported()) return;
      await registerServiceWorker();
      const perm = await requestNotificationPermission();
      if (perm === 'granted') {
        await subscribeToPush(user.id);
      }
    })();
  }, [user]);

  // Legacy `notifications` table stream (likes, comments, follows, etc.)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`push-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newNotification = payload.new as any;
          const { data: settings } = await supabase
            .from('notification_settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!checkNotificationSettings(settings, newNotification.type)) return;
          if (newNotification.type === 'message' || newNotification.type === 'message_request') {
            // Messages are handled by the dedicated messages listener below.
            return;
          }

          const { data: actor } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', newNotification.actor_id)
            .maybeSingle();

          if (actor) {
            showNotification(`${actor.username} ${getNotificationText(newNotification.type)}`, {
              body: getNotificationBody(newNotification.type),
              tag: newNotification.id,
              silent: !settings?.notification_sound,
              data: { url: '/notifications' },
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showNotification]);

  // New-messages listener: notify when a message arrives and the user isn't
  // actively viewing that conversation.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`push-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as any;
          if (!msg || msg.sender_id === user.id) return;

          // Must be a participant of this conversation.
          const { data: part } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', msg.conversation_id)
            .eq('user_id', user.id)
            .maybeSingle();
          if (!part) return;

          // Suppress if actively viewing this chat.
          if (getActiveConversation() === msg.conversation_id && isDocumentVisible()) return;

          const { data: settings } = await supabase
            .from('notification_settings')
            .select('chat_notifications, notification_sound, message_ringtone')
            .eq('user_id', user.id)
            .maybeSingle();
          if (settings?.chat_notifications === false) return;

          const { data: sender } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', msg.sender_id)
            .maybeSingle();

          const senderName = sender?.username ?? 'New message';
          const preview =
            msg.content && typeof msg.content === 'string' && msg.content.length > 0
              ? msg.content.slice(0, 120)
              : msg.media_url
                ? '📎 Sent an attachment'
                : msg.is_encrypted
                  ? '🔒 Encrypted message'
                  : 'Tap to view';

          showNotification(senderName, {
            body: preview,
            tag: `conv-${msg.conversation_id}`,
            // Let the device's native notification sound play — do not mute
            // and do not overlay an in-app tone (server also dispatches an OS
            // push for background delivery).
            silent: settings?.notification_sound === false,
            icon: sender?.avatar_url || '/favicon.ico',
            data: { url: `/messages/${msg.conversation_id}` },
          });
          // Background web push for other devices / when tab is closed is
          // dispatched server-side by a DB trigger on messages.
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, showNotification]);

  // Handle notification clicks forwarded from the SW.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'push-notification-click') return;
      const url = data.payload?.url;
      if (url && typeof url === 'string') {
        window.location.assign(url);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  return { requestPermission, showNotification };
}

function checkNotificationSettings(settings: any, type: string): boolean {
  if (!settings) return true;
  switch (type) {
    case 'message':
    case 'message_request':
      return settings.chat_notifications !== false;
    case 'story_reaction':
    case 'story_reply':
      return settings.story_like_notifications !== false;
    case 'comment':
      return settings.comment_notifications !== false;
    case 'follow':
    case 'follow_request':
    case 'follow_accepted':
      return settings.follow_notifications !== false;
    default:
      return true;
  }
}

function getNotificationText(type: string): string {
  switch (type) {
    case 'like': return 'liked your post';
    case 'comment': return 'commented on your post';
    case 'follow': return 'started following you';
    case 'follow_request': return 'requested to follow you';
    case 'follow_accepted': return 'accepted your follow request';
    case 'mention': return 'mentioned you';
    case 'message': return 'sent you a message';
    case 'story_reply': return 'replied to your story';
    case 'story_reaction': return 'reacted to your story';
    default: return 'interacted with you';
  }
}

function getNotificationBody(type: string): string {
  switch (type) {
    case 'like': return 'Tap to view your post';
    case 'comment': return 'Tap to see the comment';
    case 'follow': return 'Check out their profile';
    case 'follow_request': return 'Accept or decline';
    case 'message': return 'Tap to read the message';
    default: return 'Tap to view';
  }
}
