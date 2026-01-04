import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Grid3X3, Bookmark, Settings, UserPlus, UserMinus, MessageCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ProfileData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  website: string | null;
  is_verified: boolean;
}

interface ProfilePost {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  likes_count: number;
  comments_count: number;
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [savedPosts, setSavedPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchPosts();
      fetchFollowCounts();
      if (user) {
        checkIsFollowing();
        if (isOwnProfile) {
          fetchSavedPosts();
        }
      }
    }
  }, [userId, user]);

  const fetchProfile = async () => {
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
    setLoading(false);
  };

  const fetchPosts = async () => {
    const { data: postsData } = await supabase
      .from('posts')
      .select('id, media_url, media_type')
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

      setPosts(postsData.map(post => ({
        ...post,
        likes_count: likesCounts[post.id] || 0,
        comments_count: commentsCounts[post.id] || 0,
      })) as ProfilePost[]);
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
      .single();

    setIsFollowing(!!data);
  };

  const handleFollow = async () => {
    if (!user) {
      toast.error('Please sign in to follow users');
      return;
    }

    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId);

      if (!error) {
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
      }
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user.id, following_id: userId });

      if (!error) {
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    }

    setFollowLoading(false);
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

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="p-4 md:py-8">
          <div className="flex items-start gap-6 md:gap-12">
            <Avatar className="w-20 h-20 md:w-36 md:h-36 ring-2 ring-border">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-2xl md:text-4xl bg-primary/10 text-primary">
                {profile.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-semibold">{profile.username}</h1>
                  {profile.is_verified && (
                    <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  )}
                </div>

                <div className="flex gap-2">
                  {isOwnProfile ? (
                    <>
                      <Button asChild variant="secondary" size="sm">
                        <Link to="/settings">Edit profile</Link>
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
                        variant={isFollowing ? 'secondary' : 'gradient'}
                        size="sm"
                        onClick={handleFollow}
                        disabled={followLoading}
                      >
                        {isFollowing ? (
                          <>
                            <UserMinus className="h-4 w-4 mr-1" />
                            Following
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-1" />
                            Follow
                          </>
                        )}
                      </Button>
                      <Button variant="secondary" size="sm">
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Message
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="font-semibold">{posts.length}</span>{' '}
                  <span className="text-muted-foreground">posts</span>
                </div>
                <Link 
                  to={`/profile/${userId}/followers`}
                  className="hover:opacity-70 transition-opacity"
                >
                  <span className="font-semibold">{followersCount}</span>{' '}
                  <span className="text-muted-foreground">followers</span>
                </Link>
                <Link 
                  to={`/profile/${userId}/following`}
                  className="hover:opacity-70 transition-opacity"
                >
                  <span className="font-semibold">{followingCount}</span>{' '}
                  <span className="text-muted-foreground">following</span>
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
                {profile.website && (
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
            {profile.website && (
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

        {/* Posts Grid */}
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="w-full justify-center border-t border-border rounded-none bg-transparent h-12">
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline">Posts</span>
            </TabsTrigger>
            {isOwnProfile && (
              <TabsTrigger value="saved" className="flex items-center gap-2">
                <Bookmark className="h-4 w-4" />
                <span className="hidden sm:inline">Saved</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="posts" className="mt-0">
            {posts.length > 0 ? (
              <div className="grid grid-cols-3 gap-0.5">
                {posts.map(post => (
                  <Link
                    key={post.id}
                    to={`/post/${post.id}`}
                    className="aspect-square relative group overflow-hidden"
                  >
                    {post.media_type === 'video' ? (
                      <video
                        src={post.media_url}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={post.media_url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-4 text-primary-foreground font-semibold">
                        <span>❤️ {post.likes_count}</span>
                        <span>💬 {post.comments_count}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Grid3X3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No posts yet</p>
              </div>
            )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="saved" className="mt-0">
              {savedPosts.length > 0 ? (
                <div className="grid grid-cols-3 gap-0.5">
                  {savedPosts.map(post => (
                    <Link
                      key={post.id}
                      to={`/post/${post.id}`}
                      className="aspect-square relative group overflow-hidden"
                    >
                      <img
                        src={post.media_url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
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
      </div>
    </MainLayout>
  );
}
