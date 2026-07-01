import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, UserPlus, UserMinus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SuggestedUser {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
  is_verified: boolean;
  mutual_followers: number;
}

export function SuggestedUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSuggestedUsers();
    }
  }, [user]);

  const fetchSuggestedUsers = async () => {
    if (!user) return;

    try {
      // Get users the current user is following
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = following?.map(f => f.following_id) || [];
      followingIds.push(user.id); // Exclude self

      // Get suggested users (not already following)
      const { data: suggestedData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name, is_verified')
        .not('id', 'in', `(${followingIds.join(',')})`)
        .limit(10);

      if (suggestedData) {
        // Get mutual followers count for each suggested user
        const usersWithMutuals = await Promise.all(
          suggestedData.map(async (suggestedUser) => {
            // Get people who follow the suggested user
            const { data: theirFollowers } = await supabase
              .from('follows')
              .select('follower_id')
              .eq('following_id', suggestedUser.id);

            const theirFollowerIds = theirFollowers?.map(f => f.follower_id) || [];

            // Count how many of them the current user is following
            const mutualCount = theirFollowerIds.filter(id => 
              followingIds.includes(id) && id !== user.id
            ).length;

            return {
              ...suggestedUser,
              mutual_followers: mutualCount,
            };
          })
        );

        // Sort by mutual followers
        usersWithMutuals.sort((a, b) => b.mutual_followers - a.mutual_followers);
        setUsers(usersWithMutuals);
      }
    } catch (error) {
      console.error('Error fetching suggested users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) return;

    const isFollowing = followingUsers.has(userId);

    // Optimistic update
    setFollowingUsers(prev => {
      const newSet = new Set(prev);
      if (isFollowing) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });

    try {
      if (isFollowing) {
        await supabase.from('follows').delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
      } else {
        await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: userId,
        });

        await supabase.from('notifications').insert({
          user_id: userId,
          actor_id: user.id,
          type: 'follow',
        });
      }
    } catch (error) {
      // Revert on error
      setFollowingUsers(prev => {
        const newSet = new Set(prev);
        if (isFollowing) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    }
  };

  const handleHideUser = (userId: string) => {
    setHiddenUsers(prev => new Set([...prev, userId]));
  };

  const visibleUsers = users.filter(u => !hiddenUsers.has(u.id));

  if (loading || visibleUsers.length === 0 || hidden) {
    return null;
  }

  return (
    <div className="py-4 border-b border-border">
      <div className="flex items-center justify-between px-4 mb-3">
        <h3 className="font-semibold text-sm text-muted-foreground">Suggested for you</h3>
        <button 
          onClick={() => setHidden(true)}
          className="text-xs text-primary font-medium"
        >
          Hide
        </button>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 px-4">
          {visibleUsers.map(suggestedUser => (
            <div
              key={suggestedUser.id}
              className="flex-shrink-0 w-36 bg-card rounded-xl border border-border p-4 relative"
            >
              <button
                onClick={() => handleHideUser(suggestedUser.id)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>

              <Link 
                to={`/profile/${suggestedUser.username}`}
                className="flex flex-col items-center gap-2"
              >
                <Avatar className="w-14 h-14">
                  <AvatarImage src={suggestedUser.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {suggestedUser.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="text-center">
                  <p className="font-semibold text-sm truncate max-w-[120px]">
                    {suggestedUser.username}
                    {suggestedUser.is_verified && (
                      <svg className="inline w-3 h-3 ml-1 text-accent" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    )}
                  </p>
                  {suggestedUser.mutual_followers > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {suggestedUser.mutual_followers} mutual
                    </p>
                  )}
                </div>
              </Link>

              <Button
                variant={followingUsers.has(suggestedUser.id) ? 'secondary' : 'gradient'}
                size="sm"
                className="w-full mt-3"
                onClick={() => handleFollow(suggestedUser.id)}
              >
                {followingUsers.has(suggestedUser.id) ? (
                  <>
                    <UserMinus className="w-3 h-3 mr-1" />
                    Following
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3 h-3 mr-1" />
                    Follow
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
