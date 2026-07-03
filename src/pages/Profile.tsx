import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Grid3X3, Bookmark, Settings, UserPlus, UserMinus, MessageCircle, Plus, Film, Lock, Clock, Share2, MoreHorizontal, Pin, PlusSquare } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Seo } from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CreateStory } from '@/components/stories/CreateStory';
import { StoryHighlights } from '@/components/stories/StoryHighlights';
import { ShareSheet } from '@/components/share/ShareSheet';
import { BlockReportSheet } from '@/components/moderation/BlockReportSheet';
import { ProtectedMedia } from '@/components/media/ProtectedMedia';
import { PostActions } from '@/components/post/PostActions';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { ProfilePhotoViewer } from '@/components/profile/ProfilePhotoViewer';

interface ProfileData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  is_verified: boolean;
  is_private: boolean;
}

interface ProfilePost {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  likes_count: number;
  comments_count: number;
  is_pinned?: boolean;
  pinned_at?: string;
}

interface ProfileReel {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  view_count: number;
  likes_count: number;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [reels, setReels] = useState<ProfileReel[]>([]);
  const [savedPosts, setSavedPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [canViewContent, setCanViewContent] = useState(true);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showBlockReport, setShowBlockReport] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [isFollowBack, setIsFollowBack] = useState(false);

  const isOwnProfile = !!user && !!userId && user.id === userId;

  // Resolve username → profile (and its id) whenever the URL changes.
  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setProfile(null);
    setUserId(null);
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      if (error) console.error('Error fetching profile:', error);
      if (data) {
        setProfile(data);
        setUserId(data.id);
      }
      setLoading(false);
    })();
  }, [username]);

  useEffect(() => {
    if (userId) {
      fetchFollowCounts();
      if (user) {
        checkIsFollowing();
        checkPendingRequest();
        checkFollowBack();
      }
    }
  }, [userId, user]);

  useEffect(() => {
    if (profile && userId) {
      // Check if user can view content
      const canView = isOwnProfile || !profile.is_private || isFollowing;
      setCanViewContent(canView);

      if (canView) {
        fetchPosts();
        fetchReels();
        if (isOwnProfile) {
          fetchSavedPosts();
        }
      }
    }
  }, [profile, isFollowing, userId]);

  const fetchProfile = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
    } else {
      setProfile(data);
    }
  };

  const fetchPosts = async () => {
    const { data: postsData } = await supabase
      .from('posts')
      .select('id, media_url, media_type, is_pinned, pinned_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (postsData) {
      const postIds = postsData.map(p => p.id);

      const { data: likesData } = await supabase
        .from('likes')
        .select('post_id')
        .in('post_id', postIds);

      const { data: commentsData } = await supabase
        .from('comments')
        .select('post_id')
        .in('post_id', postIds);

      const likesCounts: Record<string, number> = {};
      likesData?.forEach(like => {
        likesCounts[like.post_id] = (likesCounts[like.post_id] || 0) + 1;
      });

      const commentsCounts: Record<string, number> = {};
      commentsData?.forEach(comment => {
        commentsCounts[comment.post_id] = (commentsCounts[comment.post_id] || 0) + 1;
      });

      // Sort: pinned posts first, then by created_at
      const enrichedPosts = postsData.map(post => ({
        ...post,
        likes_count: likesCounts[post.id] || 0,
        comments_count: commentsCounts[post.id] || 0,
      })) as ProfilePost[];

      // Sort pinned posts to the top
      enrichedPosts.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return 0;
      });

      setPosts(enrichedPosts);
    }
  };

  const fetchReels = async () => {
    const { data: reelsData } = await supabase
      .from('reels')
      .select('id, video_url, thumbnail_url, view_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (reelsData) {
      const reelIds = reelsData.map(r => r.id);

      const { data: likesData } = await supabase
        .from('reel_likes')
        .select('reel_id')
        .in('reel_id', reelIds);

      const likesCounts: Record<string, number> = {};
      likesData?.forEach(like => {
        likesCounts[like.reel_id] = (likesCounts[like.reel_id] || 0) + 1;
      });

      setReels(reelsData.map(reel => ({
        ...reel,
        likes_count: likesCounts[reel.id] || 0,
      })) as ProfileReel[]);
    }
  };

  const fetchSavedPosts = async () => {
    const { data: saves } = await supabase
      .from('saves')
      .select('post_id')
      .eq('user_id', userId);

    if (saves && saves.length > 0) {
      const postIds = saves.map(s => s.post_id);
      const { data: postsData } = await supabase
        .from('posts')
        .select('id, media_url, media_type')
        .in('id', postIds);

      if (postsData) {
        setSavedPosts(postsData.map(post => ({
          ...post,
          likes_count: 0,
          comments_count: 0,
        })) as ProfilePost[]);
      }
    }
  };

  const fetchFollowCounts = async () => {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);

    setFollowersCount(followers || 0);
    setFollowingCount(following || 0);
  };

  const checkIsFollowing = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .maybeSingle();

    setIsFollowing(!!data);
  };

  const checkPendingRequest = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('follow_requests')
      .select('id')
      .eq('requester_id', user.id)
      .eq('target_id', userId)
      .eq('status', 'pending')
      .maybeSingle();

    setIsPending(!!data);
  };

  const checkFollowBack = async () => {
    if (!user || isOwnProfile) return;
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', userId)
      .eq('following_id', user.id)
      .maybeSingle();
    setIsFollowBack(!!data);
  };

  const handleFollow = async () => {
    if (!user) {
      toast.error('Please sign in to follow users');
      return;
    }

    setFollowLoading(true);

    if (isFollowing) {
      // Unfollow
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId);

      if (!error) {
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
        setCanViewContent(isOwnProfile || !profile?.is_private);
      }
    } else if (isPending) {
      // Cancel request
      await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', user.id)
        .eq('target_id', userId);
      
      setIsPending(false);
      toast.success('Follow request cancelled');
    } else if (profile?.is_private) {
      // Send follow request for private profile
      const { error } = await supabase
        .from('follow_requests')
        .insert({
          requester_id: user.id,
          target_id: userId,
        });

      if (!error) {
        setIsPending(true);
        
        // Create notification
        await supabase.from('notifications').insert({
          user_id: userId,
          actor_id: user.id,
          type: 'follow_request',
        });
        
        toast.success('Follow request sent');
      }
    } else {
      // Direct follow for public profile
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: userId });

      if (!error) {
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        
        // Create notification
        await supabase.from('notifications').insert({
          user_id: userId,
          actor_id: user.id,
          type: 'follow',
        });
      }
    }

    setFollowLoading(false);
  };

  const handleMessage = async () => {
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
          .eq('user_id', userId)
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
        { conversation_id: newConvo.id, user_id: userId },
      ]);

      navigate(`/messages/${newConvo.id}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
    }
  };

  const getFollowButtonContent = () => {
    if (isFollowing) {
      return (
        <>
          <UserMinus className="h-4 w-4 mr-1" />
          Following
        </>
      );
    }
    if (isPending) {
      return (
        <>
          <Clock className="h-4 w-4 mr-1" />
          Requested
        </>
      );
    }
    return (
      <>
        <UserPlus className="h-4 w-4 mr-1" />
        Follow
      </>
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto p-4 space-y-6">
          <div className="flex items-start gap-6">
            <Skeleton className="w-20 h-20 md:w-32 md:h-32 rounded-full" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-6 w-32" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!profile) {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto p-4 text-center py-12">
          <h2 className="text-xl font-semibold">User not found</h2>
        </div>
      </MainLayout>
    );
  }

  const displayName = profile.full_name || profile.username;
  const profileTitle = `${displayName} (@${profile.username}) — Openflip`;
  const profileDesc = profile.bio?.slice(0, 160) || `See photos, reels and stories from @${profile.username} on Openflip.`;

  return (
    <MainLayout>
      <Seo
        title={profileTitle}
        description={profileDesc}
        path={`/profile/${profile.username}`}
        type="profile"
        image={profile.avatar_url || undefined}
        noindex={profile.is_private}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'ProfilePage',
            mainEntity: {
              '@type': 'Person',
              name: displayName,
              alternateName: profile.username,
              description: profile.bio || undefined,
              image: profile.avatar_url || undefined,
              url: `https://openflip.lovable.app/profile/${profile.username}`,
              sameAs: profile.website ? [profile.website] : undefined,
            },
          },
        ]}
      />
      <div className="max-w-4xl mx-auto">
        {/* Cover picture */}
        <div
          className="relative h-32 md:h-52 gradient-primary overflow-hidden bg-cover bg-center"
          style={(profile as any).cover_url ? { backgroundImage: `url(${(profile as any).cover_url})` } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/40" aria-hidden />
        </div>

        {/* Profile Header */}
        <div className="px-4 -mt-12 md:-mt-16 md:py-0 pb-4">
          <div className="flex items-start gap-6 md:gap-12">
            <div className="relative">
              <button onClick={() => setShowPhotoViewer(true)} className="block">
                <div className="p-[3px] rounded-full gradient-primary shadow-lg">
                  <Avatar className="w-24 h-24 md:w-36 md:h-36 ring-4 ring-background cursor-pointer hover:opacity-90 transition-opacity">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl md:text-4xl bg-primary/10 text-primary">
                      {profile.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </button>
              {isOwnProfile && (
                <button
                  onClick={() => setShowCreateStory(true)}
                  className="absolute bottom-0 right-0 w-8 h-8 md:w-9 md:h-9 rounded-full gradient-primary text-primary-foreground flex items-center justify-center border-2 border-background hover:scale-105 shadow-md transition-transform"
                >
                  <Plus className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-semibold">{profile.username}</h1>
                  {profile.is_verified && <VerifiedBadge size="lg" />}
                </div>

                <div className="flex gap-2">
                  {isOwnProfile ? (
                    <>
                      <Button asChild variant="secondary" size="sm">
                        <Link to="/settings">Edit profile</Link>
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setShowShareSheet(true)}>
                        <Share2 className="h-5 w-5" />
                      </Button>
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link to="/create">
                          <PlusSquare className="h-5 w-5" />
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link to="/settings">
                          <Settings className="h-5 w-5" />
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant={isFollowing ? 'secondary' : isPending ? 'outline' : 'gradient'}
                        size="sm"
                        onClick={handleFollow}
                        disabled={followLoading}
                      >
                        {getFollowButtonContent()}
                      </Button>
                      {!isFollowing && !isPending && isFollowBack && (
                        <span className="text-xs text-muted-foreground">Follows you</span>
                      )}
                      {(isFollowing || user) && (
                        <Button variant="secondary" size="sm" onClick={handleMessage}>
                          <MessageCircle className="h-4 w-4 mr-1" />
                          Message
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" onClick={() => setShowShareSheet(true)}>
                        <Share2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setShowBlockReport(true)}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Stats tiles */}
              <div className="grid grid-cols-3 gap-2 md:gap-3 text-sm">
                <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm px-3 py-2.5 text-center">
                  <div className="font-bold text-base md:text-lg">{posts.length}</div>
                  <div className="text-[11px] md:text-xs text-muted-foreground uppercase tracking-wide">Posts</div>
                </div>
                <Link
                  to={`/profile/${username}/followers`}
                  className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm px-3 py-2.5 text-center hover:border-primary/40 hover:bg-card transition-all"
                >
                  <div className="font-bold text-base md:text-lg">{followersCount}</div>
                  <div className="text-[11px] md:text-xs text-muted-foreground uppercase tracking-wide">Followers</div>
                </Link>
                <Link
                  to={`/profile/${username}/following`}
                  className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm px-3 py-2.5 text-center hover:border-primary/40 hover:bg-card transition-all"
                >
                  <div className="font-bold text-base md:text-lg">{followingCount}</div>
                  <div className="text-[11px] md:text-xs text-muted-foreground uppercase tracking-wide">Following</div>
                </Link>
              </div>

              {/* Bio */}
              <div className="hidden md:block space-y-1">
                {profile.full_name && (
                  <p className="font-semibold">{profile.full_name}</p>
                )}
                {profile.bio && (
                  <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>
                )}
                {profile.website && /^https?:\/\//i.test(profile.website) && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent hover:underline"
                  >
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Bio */}
          <div className="md:hidden mt-4 space-y-1">
            {profile.full_name && (
              <p className="font-semibold">{profile.full_name}</p>
            )}
            {profile.bio && (
              <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>
            )}
            {profile.website && /^https?:\/\//i.test(profile.website) && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline"
              >
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>

        {/* Story Highlights */}
        <StoryHighlights userId={userId!} isOwnProfile={isOwnProfile} />

        {/* Posts Grid - only show if can view content */}
        {canViewContent ? (
          <Tabs defaultValue="posts" className="w-full">
            <div className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-y border-border/60 px-4 py-2">
              <TabsList className="w-full max-w-md mx-auto justify-center bg-secondary/60 rounded-full p-1 h-11">
                <TabsTrigger value="posts" className="flex-1 flex items-center gap-2 rounded-full data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                  <Grid3X3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Posts</span>
                </TabsTrigger>
                <TabsTrigger value="reels" className="flex-1 flex items-center gap-2 rounded-full data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                  <Film className="h-4 w-4" />
                  <span className="hidden sm:inline">Reels</span>
                </TabsTrigger>
                {isOwnProfile && (
                  <TabsTrigger value="saved" className="flex-1 flex items-center gap-2 rounded-full data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
                    <Bookmark className="h-4 w-4" />
                    <span className="hidden sm:inline">Saved</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="posts" className="mt-0">
              {posts.length > 0 ? (
                <div className="grid grid-cols-3 gap-1 sm:gap-2 p-2 sm:p-3">
                  {posts.map(post => (
                    <div key={post.id} className="aspect-square relative group overflow-hidden rounded-xl sm:rounded-2xl">
                      <Link to={`/post/${post.id}`} className="block w-full h-full">
                        <ProtectedMedia
                          src={post.media_url}
                          type={post.media_type}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="flex items-center gap-4 text-primary-foreground font-semibold text-xs sm:text-sm">
                            <span>❤️ {post.likes_count}</span>
                            <span>💬 {post.comments_count}</span>
                          </div>
                        </div>
                      </Link>
                      {post.is_pinned && (
                        <div className="absolute top-1 left-1 bg-background/80 backdrop-blur-sm rounded-full p-1">
                          <Pin className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                        </div>
                      )}
                      {isOwnProfile && (
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <PostActions 
                            postId={post.id}
                            isPinned={post.is_pinned}
                            onDeleted={fetchPosts}
                            onPinChanged={fetchPosts}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Grid3X3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No posts yet</p>
                </div>
              )}
            </TabsContent>

          <TabsContent value="reels" className="mt-0">
            {reels.length > 0 ? (
              <div className="grid grid-cols-3 gap-1 sm:gap-2 p-2 sm:p-3">
                {reels.map(reel => (
                  <Link
                    key={reel.id}
                    to={`/reels?id=${reel.id}`}
                    className="aspect-[9/16] relative group overflow-hidden rounded-xl sm:rounded-2xl"
                  >
                    <ProtectedMedia
                      src={reel.thumbnail_url || reel.video_url}
                      type={reel.thumbnail_url ? 'image' : 'video'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-2 sm:gap-4 text-primary-foreground font-semibold text-xs sm:text-sm">
                        <span>▶️ {reel.view_count || 0}</span>
                        <span>❤️ {reel.likes_count}</span>
                      </div>
                    </div>
                    <div className="absolute bottom-1 left-1 sm:bottom-2 sm:left-2 flex items-center gap-1 text-white text-xs">
                      <Film className="w-3 h-3" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No reels yet</p>
              </div>
            )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="saved" className="mt-0">
              {savedPosts.length > 0 ? (
                <div className="grid grid-cols-3 gap-1 sm:gap-2 p-2 sm:p-3">
                  {savedPosts.map(post => (
                    <Link
                      key={post.id}
                      to={`/post/${post.id}`}
                      className="aspect-square relative group overflow-hidden rounded-xl sm:rounded-2xl"
                    >
                      <ProtectedMedia
                        src={post.media_url}
                        type={post.media_type}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No saved posts</p>
                </div>
              )}
            </TabsContent>
          )}
          </Tabs>
        ) : (
          /* Private Profile Lock View */
          <div className="border-t border-border">
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-20 h-20 rounded-full border-2 border-foreground flex items-center justify-center mb-4">
                <Lock className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-semibold mb-2">This Account is Private</h3>
              <p className="text-muted-foreground max-w-xs">
                Follow this account to see their photos and videos.
              </p>
            </div>
          </div>
        )}
        {/* Create Story Modal */}
        {showCreateStory && (
          <CreateStory
            onClose={() => setShowCreateStory(false)}
            onCreated={() => setShowCreateStory(false)}
          />
        )}

        {/* Share Sheet */}
        <ShareSheet
          open={showShareSheet}
          onOpenChange={setShowShareSheet}
          type="profile"
          itemId={userId!}
          itemUrl={`${window.location.origin}/profile/${username}`}
        />

        {/* Block/Report Sheet */}
        {!isOwnProfile && profile && (
          <BlockReportSheet
            open={showBlockReport}
            onOpenChange={setShowBlockReport}
            targetUserId={userId!}
            targetUsername={profile.username}
            onBlocked={() => navigate('/')}
          />
        )}

        {/* Full-screen Profile Photo Viewer */}
        <ProfilePhotoViewer
          open={showPhotoViewer}
          onOpenChange={setShowPhotoViewer}
          imageUrl={profile.avatar_url}
          username={profile.username}
        />
      </div>
    </MainLayout>
  );
}
