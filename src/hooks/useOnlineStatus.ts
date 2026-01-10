import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface OnlineStatus {
  user_id: string;
  is_online: boolean;
  last_seen_at: string;
}

export function useOnlineStatus() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Record<string, OnlineStatus>>({});

  // Update own status
  const updateOnlineStatus = useCallback(async (isOnline: boolean) => {
    if (!user) return;

    try {
      const { error } = await (supabase as any)
        .from('user_online_status')
        .upsert({
          user_id: user.id,
          is_online: isOnline,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) console.error('Error updating online status:', error);
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  }, [user]);

  // Set up presence on mount
  useEffect(() => {
    if (!user) return;

    // Mark as online
    updateOnlineStatus(true);

    // Update every 30 seconds
    const interval = setInterval(() => {
      updateOnlineStatus(true);
    }, 30000);

    // Mark as offline on page unload
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateOnlineStatus(false);
      } else {
        updateOnlineStatus(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      updateOnlineStatus(false);
    };
  }, [user, updateOnlineStatus]);

  // Fetch online status for specific users
  const fetchOnlineStatus = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;

    try {
      const { data, error } = await (supabase as any)
        .from('user_online_status')
        .select('*')
        .in('user_id', userIds);

      if (error) throw error;

      const statusMap: Record<string, OnlineStatus> = {};
      (data || []).forEach((status: OnlineStatus) => {
        statusMap[status.user_id] = status;
      });

      setOnlineUsers(prev => ({ ...prev, ...statusMap }));
    } catch (error) {
      console.error('Error fetching online status:', error);
    }
  }, []);

  // Subscribe to online status changes
  const subscribeToOnlineStatus = useCallback((userIds: string[]) => {
    if (userIds.length === 0) return () => {};

    const channel = supabase
      .channel('online-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_online_status',
          filter: `user_id=in.(${userIds.join(',')})`,
        },
        (payload) => {
          const status = payload.new as OnlineStatus;
          setOnlineUsers(prev => ({
            ...prev,
            [status.user_id]: status,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Helper to check if user is online
  const isUserOnline = useCallback((userId: string) => {
    const status = onlineUsers[userId];
    if (!status) return false;
    
    // Consider online if is_online is true and last_seen within 2 minutes
    const lastSeen = new Date(status.last_seen_at);
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return status.is_online && lastSeen > twoMinutesAgo;
  }, [onlineUsers]);

  // Get last seen text
  const getLastSeenText = useCallback((userId: string) => {
    const status = onlineUsers[userId];
    if (!status) return null;
    
    if (isUserOnline(userId)) return 'Active now';
    
    const lastSeen = new Date(status.last_seen_at);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    if (diffDays < 7) return `Active ${diffDays}d ago`;
    return 'Active long ago';
  }, [onlineUsers, isUserOnline]);

  return {
    onlineUsers,
    isUserOnline,
    getLastSeenText,
    fetchOnlineStatus,
    subscribeToOnlineStatus,
    updateOnlineStatus,
  };
}
