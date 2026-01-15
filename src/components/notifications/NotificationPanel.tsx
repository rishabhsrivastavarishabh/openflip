import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, Heart, MessageCircle, UserPlus, AtSign, 
  Play, X, CheckCheck, Loader2, Film, Image
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  type: string;
  actor_id: string;
  post_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (open && user) {
      fetchNotifications();
      subscribeToNotifications();
    }
  }, [open, user]);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch actor profiles
      const actorIds = [...new Set(data?.map(n => n.actor_id) || [])];
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_verified')
          .in('id', actorIds);

        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enrichedNotifications = data?.map(n => ({
          ...n,
          actor: profilesMap.get(n.actor_id),
        })) || [];

        setNotifications(enrichedNotifications);
      } else {
        setNotifications([]);
      }

      // Mark as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-panel')
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
          
          // Fetch actor profile
          const { data: actor } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, is_verified')
            .eq('id', newNotification.actor_id)
            .single();

          setNotifications(prev => [{
            ...newNotification,
            actor,
          }, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-destructive fill-destructive" />;
      case 'comment': return <MessageCircle className="w-4 h-4 text-primary" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-accent" />;
      case 'follow_request': return <UserPlus className="w-4 h-4 text-primary" />;
      case 'follow_accepted': return <CheckCheck className="w-4 h-4 text-green-500" />;
      case 'mention': return <AtSign className="w-4 h-4 text-primary" />;
      case 'message': return <MessageCircle className="w-4 h-4 text-accent" />;
      case 'story_reply': return <Image className="w-4 h-4 text-primary" />;
      case 'story_reaction': return <Heart className="w-4 h-4 text-primary" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getNotificationText = (type: string) => {
    switch (type) {
      case 'like': return 'liked your post';
      case 'comment': return 'commented on your post';
      case 'follow': return 'started following you';
      case 'follow_request': return 'requested to follow you';
      case 'follow_accepted': return 'accepted your follow request';
      case 'mention': return 'mentioned you in a comment';
      case 'message': return 'sent you a message';
      case 'story_reply': return 'replied to your story';
      case 'story_reaction': return 'reacted to your story';
      default: return 'interacted with you';
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    if (notification.post_id) {
      navigate(`/post/${notification.post_id}`);
    } else if (notification.type === 'follow' || notification.type === 'follow_request' || notification.type === 'follow_accepted') {
      navigate(`/profile/${notification.actor_id}`);
    } else if (notification.type === 'message') {
      navigate('/messages');
    } else {
      navigate(`/profile/${notification.actor_id}`);
    }
    onOpenChange(false);
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true;
    if (activeTab === 'likes') return n.type === 'like';
    if (activeTab === 'comments') return n.type === 'comment';
    if (activeTab === 'follows') return n.type.includes('follow');
    return true;
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        <SheetHeader className="p-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notifications
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start px-4 py-2 border-b bg-transparent shrink-0">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="likes" className="text-xs">Likes</TabsTrigger>
            <TabsTrigger value="comments" className="text-xs">Comments</TabsTrigger>
            <TabsTrigger value="follows" className="text-xs">Follows</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <TabsContent value={activeTab} className="m-0 p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  <AnimatePresence mode="popLayout">
                    {filteredNotifications.map((notification, index) => (
                      <motion.button
                        key={notification.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => handleNotificationClick(notification)}
                        className={cn(
                          "w-full flex items-start gap-3 p-4 text-left hover:bg-secondary/50 transition-colors",
                          !notification.is_read && "bg-primary/5"
                        )}
                      >
                        <div className="relative">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={notification.actor?.avatar_url || undefined} />
                            <AvatarFallback>
                              {notification.actor?.username?.charAt(0).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background flex items-center justify-center">
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-semibold">{notification.actor?.username}</span>
                            {' '}{getNotificationText(notification.type)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>

                        {!notification.is_read && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                        )}
                      </motion.button>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
