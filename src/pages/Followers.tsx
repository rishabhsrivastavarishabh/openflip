import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Search, UserCheck, Users } from 'lucide-react';
import { Profile } from '@/types/database';

interface FollowUser extends Profile {
  isFollowing?: boolean;
  isMutual?: boolean;
}

export default function Followers() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileUsername, setProfileUsername] = useState('');

  useEffect(() => {
    if (userId) {
      fetchFollowers();
      fetchProfile();
    }
  }, [userId]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    
    if (data) setProfileUsername(data.username);
  };

  const fetchFollowers = async () => {
    if (!userId) return;

    try {
      // Get follower IDs
      const { data: follows } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId);

      const followerIds = follows?.map(f => f.follower_id) || [];
      
      if (followerIds.length === 0) {
        setFollowers([]);
        setLoading(false);
        return;
      }

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', followerIds);

      // Check if current user follows these people
      let currentUserFollowing = new Set<string>();
      let mutualFollowers = new Set<string>();

      if (user) {
        const { data: following } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .in('following_id', followerIds);

        currentUserFollowing = new Set(following?.map(f => f.following_id) || []);

        // Check mutual (they also follow current user)
        if (user.id === userId) {
          const { data: mutual } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('following_id', user.id)
            .in('follower_id', followerIds);

          mutualFollowers = new Set(mutual?.map(f => f.follower_id) || []);
        }
      }

      const enriched: FollowUser[] = (profiles || []).map(p => ({
        ...p,
        isFollowing: currentUserFollowing.has(p.id),
        isMutual: mutualFollowers.has(p.id),
      }));

      setFollowers(enriched);
    } catch (error) {
      console.error('Error fetching followers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (targetUserId: string, isFollowing: boolean) => {
    if (!user) return;

    try {
      if (isFollowing) {
        await supabase.from('follows').delete().match({
          follower_id: user.id,
          following_id: targetUserId,
        });
      } else {
        await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: targetUserId,
        });
      }

      setFollowers(prev =>
        prev.map(f =>
          f.id === targetUserId ? { ...f, isFollowing: !isFollowing } : f
        )
      );
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const filteredFollowers = followers.filter(f =>
    f.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4">
          <div className="flex items-center gap-4">
            <Link to={`/profile/${userId}`}>
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Followers</h1>
              <p className="text-sm text-muted-foreground">@{profileUsername}</p>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-border">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="w-24 h-4 mb-1" />
                  <Skeleton className="w-16 h-3" />
                </div>
                <Skeleton className="w-20 h-9 rounded-lg" />
              </div>
            ))
          ) : filteredFollowers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No followers yet</p>
            </div>
          ) : (
            filteredFollowers.map((follower) => (
              <div key={follower.id} className="flex items-center gap-3 p-4">
                <Link to={`/profile/${follower.id}`}>
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={follower.avatar_url || undefined} />
                    <AvatarFallback>{follower.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${follower.id}`} className="flex items-center gap-1">
                    <span className="font-medium truncate">{follower.username}</span>
                    {follower.isMutual && (
                      <UserCheck className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </Link>
                  {follower.full_name && (
                    <p className="text-sm text-muted-foreground truncate">{follower.full_name}</p>
                  )}
                </div>
                {user && user.id !== follower.id && (
                  <Button
                    variant={follower.isFollowing ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleFollow(follower.id, follower.isFollowing || false)}
                  >
                    {follower.isFollowing ? 'Following' : 'Follow'}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
