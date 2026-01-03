import { useState, useEffect } from 'react';
import { Search, TrendingUp, Hash, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ExplorePost {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  likes_count: number;
  comments_count: number;
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
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');

  useEffect(() => {
    fetchExplorePosts();
  }, []);

  useEffect(() => {
    if (searchQuery.length > 0) {
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

  const searchUsers = async () => {
    setSearchLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_verified')
      .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
      .limit(20);

    if (!error && data) {
      setUsers(data);
    }
    setSearchLoading(false);
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Search Bar */}
        <div className="sticky top-0 z-40 glass-strong -mx-4 px-4 py-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {searchQuery.length > 0 ? (
          <div className="space-y-2">
            <h2 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <User className="h-5 w-5" />
              Search Results
            </h2>
            {searchLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
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
                  to={`/profile/${user.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
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
              <p className="text-center text-muted-foreground py-8">No users found</p>
            )}
          </div>
        ) : (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full mb-4">
                <TabsTrigger value="posts" className="flex-1">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Trending
                </TabsTrigger>
                <TabsTrigger value="hashtags" className="flex-1">
                  <Hash className="h-4 w-4 mr-2" />
                  Tags
                </TabsTrigger>
              </TabsList>

              <TabsContent value="posts">
                {loading ? (
                  <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-square" />
                    ))}
                  </div>
                ) : posts.length > 0 ? (
                  <div className="grid grid-cols-3 gap-1">
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
                            <span className="flex items-center gap-1">
                              ❤️ {post.likes_count}
                            </span>
                            <span className="flex items-center gap-1">
                              💬 {post.comments_count}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No posts to explore yet</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="hashtags">
                <div className="text-center py-12">
                  <Hash className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Hashtags will appear here as users create posts</p>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </MainLayout>
  );
}
