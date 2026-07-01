import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Search, UserCheck, Users, MessageCircle } from 'lucide-react';
import { Profile } from '@/types/database';
import { toast } from 'sonner';

interface FollowUser extends Profile {
  isFollowing?: boolean;
  isMutual?: boolean;
}

export default function Followers() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileUsername, setProfileUsername] = useState('');

  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', username)
        .maybeSingle();
      if (data) {
        setUserId(data.id);
        setProfileUsername(data.username);
      } else {
        setLoading(false);
      }
    })();
  }, [username]);

  useEffect(() => {
    if (userId) {
      fetchFollowers();
    }
  }, [userId]);

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

        // Create notification
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          actor_id: user.id,
          type: 'follow',
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

  const handleMessage = async (targetUserId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      // Check for existing conversation
      const { data: myConversations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const myConvoIds = myConversations?.map(c => c.conversation_id) || [];

      if (myConvoIds.length > 0) {
        const { data: existingConvo } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', targetUserId)
          .in('conversation_id', myConvoIds)
          .maybeSingle();

        if (existingConvo) {
          navigate(`/messages/${existingConvo.conversation_id}`);
          return;
        }
      }

      // Create new conversation
      const { data: newConvo, error: convoError } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();

      if (convoError) throw convoError;

      // Add participants
      await supabase.from('conversation_participants').insert([
        { conversation_id: newConvo.id, user_id: user.id },
        { conversation_id: newConvo.id, user_id: targetUserId },
      ]);

      navigate(`/messages/${newConvo.id}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
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
                <Link to={`/profile/${follower.username}`}>
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={follower.avatar_url || undefined} />
                    <AvatarFallback>{follower.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${follower.username}`} className="flex items-center gap-1">
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
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleMessage(follower.id)}
                      className="h-9 w-9"
                    >
                      <MessageCircle className="h-5 w-5" />
                    </Button>
                    <Button
                      variant={follower.isFollowing ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleFollow(follower.id, follower.isFollowing || false)}
                    >
                      {follower.isFollowing ? 'Following' : 'Follow'}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
