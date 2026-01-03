import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationItem {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  created_at: string;
  is_read: boolean;
  post_id: string | null;
  actor: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      markAsRead();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        created_at,
        is_read,
        post_id,
        profiles!notifications_actor_id_fkey(id, username, avatar_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data.map((n: any) => ({
        ...n,
        actor: n.profiles,
      })));
    }
    setLoading(false);
  };

  const markAsRead = async () => {
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
  };

  const getNotificationText = (type: string) => {
    switch (type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'started following you';
      case 'mention':
        return 'mentioned you in a comment';
      default:
        return '';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="h-4 w-4 text-destructive fill-destructive" />;
      case 'comment':
        return <MessageCircle className="h-4 w-4 text-accent" />;
      case 'follow':
        return <UserPlus className="h-4 w-4 text-primary" />;
      default:
        return null;
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4 text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Sign in to see notifications</h2>
          <p className="text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to view your notifications
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-4">
          <h1 className="font-semibold text-lg">Notifications</h1>
        </header>

        <div className="divide-y divide-border">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))
          ) : notifications.length > 0 ? (
            notifications.map(notification => (
              <Link
                key={notification.id}
                to={notification.post_id ? `/post/${notification.post_id}` : `/profile/${notification.actor.id}`}
                className="flex items-start gap-3 p-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="relative">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={notification.actor.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {notification.actor.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background flex items-center justify-center">
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{notification.actor.username}</span>{' '}
                    {getNotificationText(notification.type)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!notification.is_read && (
                  <div className="w-2 h-2 rounded-full bg-accent" />
                )}
              </Link>
            ))
          ) : (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No notifications yet</h3>
              <p className="text-sm text-muted-foreground">
                When someone likes or comments on your posts, you'll see it here
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
