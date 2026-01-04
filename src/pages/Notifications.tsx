import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, UserPlus, UserCheck, X, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface NotificationItem {
  id: string;
  type: string;
  created_at: string;
  is_read: boolean;
  post_id: string | null;
  actor: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

interface FollowRequest {
  id: string;
  requester_id: string;
  created_at: string;
  requester: {
    id: string;
    username: string;
    avatar_url: string | null;
    full_name: string | null;
  };
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchFollowRequests();
      markAsRead();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, created_at, is_read, post_id, actor_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      // Fetch actor profiles separately
      const actorIds = [...new Set(data.map(n => n.actor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', actorIds);

      const profilesMap: Record<string, any> = {};
      profiles?.forEach(p => {
        profilesMap[p.id] = p;
      });

      setNotifications(data.map((n: any) => ({
        ...n,
        actor: profilesMap[n.actor_id] || { id: n.actor_id, username: 'Unknown', avatar_url: null },
      })));
    }
    setLoading(false);
  };

  const fetchFollowRequests = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('follow_requests')
      .select('id, requester_id, created_at')
      .eq('target_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const requesterIds = data.map(r => r.requester_id);
      
      if (requesterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, full_name')
          .in('id', requesterIds);

        const profilesMap: Record<string, any> = {};
        profiles?.forEach(p => {
          profilesMap[p.id] = p;
        });

        setFollowRequests(data.map((r: any) => ({
          ...r,
          requester: profilesMap[r.requester_id] || { id: r.requester_id, username: 'Unknown', avatar_url: null, full_name: null },
        })));
      }
    }
    setRequestsLoading(false);
  };

  const markAsRead = async () => {
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
  };

  const handleAcceptRequest = async (requestId: string, requesterId: string) => {
    if (!user) return;

    try {
      // Update request status
      await supabase
        .from('follow_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      // Create follow relationship
      await supabase.from('follows').insert({
        follower_id: requesterId,
        following_id: user.id,
      });

      // Create notification for requester
      await supabase.from('notifications').insert({
        user_id: requesterId,
        actor_id: user.id,
        type: 'follow_accepted',
      });

      setFollowRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Follow request accepted');
    } catch (error) {
      console.error('Error accepting request:', error);
      toast.error('Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await supabase
        .from('follow_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      setFollowRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Follow request rejected');
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
    }
  };

  const getNotificationText = (type: string) => {
    switch (type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'started following you';
      case 'follow_request':
        return 'requested to follow you';
      case 'follow_accepted':
        return 'accepted your follow request';
      case 'mention':
        return 'mentioned you in a comment';
      case 'message':
        return 'sent you a message';
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
      case 'follow_request':
        return <UserPlus className="h-4 w-4 text-primary" />;
      case 'follow_accepted':
        return <UserCheck className="h-4 w-4 text-green-500" />;
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

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start px-4 pt-2 bg-transparent">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Requests
              {followRequests.length > 0 && (
                <span className="ml-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                  {followRequests.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
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
          </TabsContent>

          <TabsContent value="requests" className="mt-0">
            <div className="divide-y divide-border">
              {requestsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-9 w-20" />
                  </div>
                ))
              ) : followRequests.length > 0 ? (
                followRequests.map(request => (
                  <div key={request.id} className="flex items-center gap-3 p-4">
                    <Link to={`/profile/${request.requester.id}`}>
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={request.requester.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {request.requester.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/profile/${request.requester.id}`}>
                        <p className="font-semibold truncate">{request.requester.username}</p>
                      </Link>
                      {request.requester.full_name && (
                        <p className="text-sm text-muted-foreground truncate">{request.requester.full_name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleAcceptRequest(request.id, request.requester_id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectRequest(request.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No follow requests</h3>
                  <p className="text-sm text-muted-foreground">
                    When someone requests to follow you, you'll see it here
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
