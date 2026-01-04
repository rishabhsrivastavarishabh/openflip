import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface FollowRelationship {
  isFollowing: boolean;
  isFollower: boolean;
  isPending: boolean;
  canMessage: boolean;
}

export function useFollowRelationship(targetUserId: string | undefined) {
  const { user } = useAuth();
  const [relationship, setRelationship] = useState<FollowRelationship>({
    isFollowing: false,
    isFollower: false,
    isPending: false,
    canMessage: false,
  });
  const [loading, setLoading] = useState(true);

  const checkRelationship = useCallback(async () => {
    if (!user || !targetUserId || user.id === targetUserId) {
      setLoading(false);
      return;
    }

    try {
      // Check if current user follows target
      const { data: following } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      // Check if target follows current user
      const { data: follower } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', targetUserId)
        .eq('following_id', user.id)
        .maybeSingle();

      // Check for pending follow request
      const { data: pendingRequest } = await supabase
        .from('follow_requests')
        .select('id')
        .eq('requester_id', user.id)
        .eq('target_id', targetUserId)
        .eq('status', 'pending')
        .maybeSingle();

      const isFollowing = !!following;
      const isFollower = !!follower;
      const isPending = !!pendingRequest;

      // Can message if either follows the other
      const canMessage = isFollowing || isFollower;

      setRelationship({
        isFollowing,
        isFollower,
        isPending,
        canMessage,
      });
    } catch (error) {
      console.error('Error checking follow relationship:', error);
    } finally {
      setLoading(false);
    }
  }, [user, targetUserId]);

  useEffect(() => {
    checkRelationship();
  }, [checkRelationship]);

  return { ...relationship, loading, refresh: checkRelationship };
}
