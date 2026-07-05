import { useState, useEffect } from 'react';
import { getFirstPostMediaUrl } from '@/lib/utils';
import { Search, TrendingUp, Hash, User, Film, Grid3X3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Seo } from '@/components/seo/Seo';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProtectedMedia } from '@/components/media/ProtectedMedia';


interface ExplorePost {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  likes_count: number;
  comments_count: number;
}

interface ExploreReel {
  id: string;
  video_url: string;
  thumbnail_url: string | null;
  view_count: number;
  likes_count: number;
}

interface SearchUser {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [reels, setReels] = useState<ExploreReel[]>([]);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    fetchExplorePosts();
    fetchExploreReels();
  }, []);

  // Sanitize search query by escaping special SQL ILIKE characters
  const sanitizeSearchQuery = (query: string): string => {
    return query
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/%/g, '\\%')    // Escape percent signs
      .replace(/_/g, '\\_');   // Escape underscores
  };

  // Validate search query - only allow safe characters
  const isValidSearchQuery = (query: string): boolean => {
    // Allow alphanumeric, spaces, and common name characters
    // Max length 100 characters for safety
    return query.length <= 100 && /^[a-zA-Z0-9\s._-]*$/.test(query);
  };

  useEffect(() => {
    if (searchQuery.length > 0 && isValidSearchQuery(searchQuery)) {
      const timer = setTimeout(() => {
        searchUsers();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  const fetchExplorePosts = async () => {
    const { data: postsData, error } = await supabase
      .from('posts')
      .select('id, media_url, media_type')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching posts:', error);
      setLoading(false);
      return;
    }

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

      const enrichedPosts = postsData.map(post => ({
        ...post,
        likes_count: likesCounts[post.id] || 0,
        comments_count: commentsCounts[post.id] || 0,
      }));

      setPosts(enrichedPosts as ExplorePost[]);
    }

    setLoading(false);
  };

  const fetchExploreReels = async () => {
    const { data: reelsData, error } = await supabase
      .from('reels')
      .select('id, video_url, thumbnail_url, view_count')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error fetching reels:', error);
      return;
    }

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
      })) as ExploreReel[]);
    }
  };

  const searchUsers = async () => {
    if (!isValidSearchQuery(searchQuery)) {
      setUsers([]);
      return;
    }

    setSearchLoading(true);
    
    // Sanitize the query to escape special ILIKE characters
    const sanitizedQuery = sanitizeSearchQuery(searchQuery.trim());
    const searchPattern = `%${sanitizedQuery}%`;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_verified')
      .or(`username.ilike.${searchPattern},full_name.ilike.${searchPattern}`)
      .limit(20);

    if (!error && data) {
      setUsers(data);
    }
    setSearchLoading(false);
  };

  return (
    <MainLayout>
      <Seo
        title="Explore — Openflip"
        description="Discover trending photos, reels, hashtags, and creators across Openflip."
        path="/explore"
      />
      <div className="max-w-4xl mx-auto px-4 py-4">
        <h1 className="sr-only">Explore Openflip</h1>
        {/* Search Bar */}
        <div className="sticky top-0 z-40 header-glow -mx-4 px-4 py-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl gradient-primary flex items-center justify-center shadow-glow shrink-0">
              <TrendingUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users, creators, hashtags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-11 rounded-full bg-background/60 border-border/40 backdrop-blur-lg focus-visible:ring-primary/40"
                maxLength={100}
              />
            </div>
          </div>
        </div>

        {searchQuery.length > 0 ? (
          <div className="space-y-2">
            <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-primary" />
              Search Results
            </h2>
            {searchLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 glass-tile">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))
            ) : users.length > 0 ? (
              users.map(user => (
                <Link
                  key={user.id}
                  to={`/profile/${user.username}`}
                  className="flex items-center gap-3 p-3 rounded-2xl glass-tile hover:shadow-glow transition-all"
                >
                  <div className="p-[2px] rounded-full gradient-primary">
                    <Avatar className="h-12 w-12 border-2 border-background">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">{user.username}</span>
                      {user.is_verified && (
                        <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      )}
                    </div>
                    {user.full_name && (
                      <span className="text-sm text-muted-foreground">{user.full_name}</span>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-16 glass-card">
                <p className="text-muted-foreground">No users found</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full mb-4 glass-tile p-1 h-auto gap-1 bg-transparent">
                <TabsTrigger value="posts" className="flex-1 rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow">
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Posts
                </TabsTrigger>
                <TabsTrigger value="reels" className="flex-1 rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow">
                  <Film className="h-4 w-4 mr-2" />
                  Reels
                </TabsTrigger>
                <TabsTrigger value="trending" className="flex-1 rounded-xl data-[state=active]:gradient-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Trending
                </TabsTrigger>
              </TabsList>

              <TabsContent value="posts">
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square rounded-2xl" />
                    ))}
                  </div>
                ) : posts.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {posts.map(post => (
                      <Link
                        key={post.id}
                        to={`/post/${post.id}`}
                        className="aspect-square relative group overflow-hidden rounded-2xl border border-border/40 hover:shadow-glow hover:-translate-y-0.5 transition-all"
                      >
                        <ProtectedMedia
                          src={post.media_url}
                          type={post.media_type}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                          <div className="flex items-center gap-3 text-white font-semibold text-xs sm:text-sm">
                            <span className="flex items-center gap-1">❤️ {post.likes_count}</span>
                            <span className="flex items-center gap-1">💬 {post.comments_count}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 glass-card">
                    <div className="w-16 h-16 rounded-3xl gradient-primary mx-auto mb-4 flex items-center justify-center shadow-glow">
                      <Grid3X3 className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <p className="text-muted-foreground">No posts to explore yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reels">
                {reels.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {reels.map(reel => (
                      <Link
                        key={reel.id}
                        to={`/reels?id=${reel.id}`}
                        className="aspect-[9/16] relative group overflow-hidden rounded-2xl border border-border/40 hover:shadow-glow hover:-translate-y-0.5 transition-all"
                      >
                        <ProtectedMedia
                          src={reel.thumbnail_url || reel.video_url}
                          type={reel.thumbnail_url ? 'image' : 'video'}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider text-white bg-black/40 backdrop-blur-md border border-white/20">
                          REEL
                        </div>
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs font-medium">
                          <Film className="w-3 h-3" />
                          <span>{reel.view_count || 0}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 glass-card">
                    <div className="w-16 h-16 rounded-3xl gradient-primary mx-auto mb-4 flex items-center justify-center shadow-glow">
                      <Film className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <p className="text-muted-foreground">No reels to explore yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="trending">
                <div className="text-center py-16 glass-card">
                  <div className="w-16 h-16 rounded-3xl gradient-primary mx-auto mb-4 flex items-center justify-center shadow-glow">
                    <TrendingUp className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <p className="text-muted-foreground">Trending content will appear here</p>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </MainLayout>
  );
}
