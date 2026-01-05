import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseBlockedUserResult {
  isBlocked: boolean;
  isBlockedByThem: boolean;
  loading: boolean;
  blockUser: () => Promise<void>;
  unblockUser: () => Promise<void>;
}

export function useBlockedUser(targetUserId: string | undefined): UseBlockedUserResult {
  const { user } = useAuth();
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkBlockStatus = useCallback(async () => {
    if (!user || !targetUserId) {
      setLoading(false);
      return;
    }

    try {
      // Check if current user blocked target
      const { data: blockedByMe } = await (supabase as any)
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId)
        .maybeSingle();

      setIsBlocked(!!blockedByMe);

      // Check if target blocked current user
      const { data: blockedByThem } = await (supabase as any)
        .from('blocked_users')
        .select('id')
        .eq('blocker_id', targetUserId)
        .eq('blocked_id', user.id)
        .maybeSingle();

      setIsBlockedByThem(!!blockedByThem);
    } catch (error) {
      console.error('Error checking block status:', error);
    } finally {
      setLoading(false);
    }
  }, [user, targetUserId]);

  useEffect(() => {
    checkBlockStatus();
  }, [checkBlockStatus]);

  const blockUser = async () => {
    if (!user || !targetUserId) return;

    try {
      await (supabase as any).from('blocked_users').insert({
        blocker_id: user.id,
        blocked_id: targetUserId,
      });

      // Remove follow relationships
      await Promise.all([
        supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId),
        supabase
          .from('follows')
          .delete()
          .eq('follower_id', targetUserId)
          .eq('following_id', user.id),
      ]);

      setIsBlocked(true);
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  };

  const unblockUser = async () => {
    if (!user || !targetUserId) return;

    try {
      await (supabase as any)
        .from('blocked_users')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId);

      setIsBlocked(false);
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    }
  };

  return {
    isBlocked,
    isBlockedByThem,
    loading,
    blockUser,
    unblockUser,
  };
}
