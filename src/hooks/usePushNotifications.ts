import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function usePushNotifications() {
  const { user } = useAuth();

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Request permission on mount
    requestPermission();

    // Subscribe to new notifications
    const channel = supabase
      .channel('push-notifications')
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

          // Check if user has notification settings enabled
          const { data: settings } = await supabase
            .from('notification_settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          // Check notification type settings
          const shouldNotify = checkNotificationSettings(settings, newNotification.type);
          if (!shouldNotify) return;

          // Fetch actor profile
          const { data: actor } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', newNotification.actor_id)
            .single();

          if (actor) {
            const notificationText = getNotificationText(newNotification.type);
            showNotification(`${actor.username} ${notificationText}`, {
              body: getNotificationBody(newNotification.type),
              tag: newNotification.id,
              silent: !settings?.notification_sound,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, requestPermission, showNotification]);

  return { requestPermission, showNotification };
}

function checkNotificationSettings(settings: any, type: string): boolean {
  if (!settings) return true; // Default to enabled if no settings

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
