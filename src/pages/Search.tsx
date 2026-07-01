import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ProtectedMedia } from '@/components/media/ProtectedMedia';
import { Search, X, Clock, TrendingUp, Users, Hash, Film, Image } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  users: any[];
  posts: any[];
  reels: any[];
  hashtags: any[];
}

interface SearchHistoryItem {
  id: string;
  query: string;
  search_type: string;
  created_at: string;
}

export default function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult>({ users: [], posts: [], reels: [], hashtags: [] });
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSearchHistory();
    }
  }, [user]);

  const fetchSearchHistory = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) {
      setSearchHistory(data);
    }
  };

  const saveSearchHistory = async (searchQuery: string, searchType: string) => {
    if (!user || !searchQuery.trim()) return;
    
    // Remove duplicate if exists
    await supabase
      .from('search_history')
      .delete()
      .eq('user_id', user.id)
      .eq('query', searchQuery.trim());
    
    // Insert new
    await supabase
      .from('search_history')
      .insert({
        user_id: user.id,
        query: searchQuery.trim(),
        search_type: searchType
      });
    
    fetchSearchHistory();
  };

  const deleteSearchHistoryItem = async (id: string) => {
    await supabase
      .from('search_history')
      .delete()
      .eq('id', id);
    
    setSearchHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearAllHistory = async () => {
    if (!user) return;
    
    await supabase
      .from('search_history')
      .delete()
      .eq('user_id', user.id);
    
    setSearchHistory([]);
  };

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ users: [], posts: [], reels: [], hashtags: [] });
      setShowHistory(true);
      return;
    }

    setLoading(true);
    setShowHistory(false);

    try {
      const searchTerm = `%${searchQuery.trim()}%`;

      // Search users
      const { data: users } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.${searchTerm},full_name.ilike.${searchTerm}`)
        .limit(20);

      // Search posts by caption
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .ilike('caption', searchTerm)
        .order('created_at', { ascending: false })
        .limit(20);

      // Enrich posts with profiles
      const enrichedPosts = await Promise.all((posts || []).map(async (post) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url, is_verified')
          .eq('id', post.user_id)
          .single();
        return { ...post, profile };
      }));

      // Search reels by caption
      const { data: reels } = await supabase
        .from('reels')
        .select('*')
        .ilike('caption', searchTerm)
        .order('created_at', { ascending: false })
        .limit(20);

      // Enrich reels with profiles
      const enrichedReels = await Promise.all((reels || []).map(async (reel) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url, is_verified')
          .eq('id', reel.user_id)
          .single();
        return { ...reel, profile };
      }));

      // Search hashtags
      const { data: hashtags } = await supabase
        .from('hashtags')
        .select('*')
        .ilike('name', searchTerm)
        .limit(20);

      // Get post counts for hashtags
      const enrichedHashtags = await Promise.all((hashtags || []).map(async (hashtag) => {
        const { count } = await supabase
          .from('post_hashtags')
          .select('*', { count: 'exact', head: true })
          .eq('hashtag_id', hashtag.id);
        return { ...hashtag, post_count: count || 0 };
      }));

      setResults({
        users: users || [],
        posts: enrichedPosts,
        reels: enrichedReels,
        hashtags: enrichedHashtags
      });

      // Save to history
      saveSearchHistory(searchQuery, activeTab);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, user]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, performSearch]);

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    performSearch(historyQuery);
  };

  const totalResults = results.users.length + results.posts.length + results.reels.length + results.hashtags.length;

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto p-4 pb-20">
        {/* Search Header */}
        <div className="sticky top-0 z-10 bg-background pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search users, posts, reels, hashtags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => {
                  setQuery('');
                  setResults({ users: [], posts: [], reels: [], hashtags: [] });
                  setShowHistory(true);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search History */}
        {showHistory && searchHistory.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Searches
              </h3>
              <Button variant="ghost" size="sm" onClick={clearAllHistory}>
                Clear all
              </Button>
            </div>
            <div className="space-y-2">
              {searchHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer"
                  onClick={() => handleHistoryClick(item.query)}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{item.query}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSearchHistoryItem(item.id);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {query.trim() && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 mb-4">
              <TabsTrigger value="all" className="text-xs">
                All {totalResults > 0 && `(${totalResults})`}
              </TabsTrigger>
              <TabsTrigger value="users" className="text-xs">
                <Users className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="posts" className="text-xs">
                <Image className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="reels" className="text-xs">
                <Film className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="hashtags" className="text-xs">
                <Hash className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <TabsContent value="all" className="space-y-6">
                  {/* Users */}
                  {results.users.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Users
                      </h3>
                      <div className="space-y-2">
                        {results.users.slice(0, 5).map((profile) => (
                          <Link
                            key={profile.id}
                            to={`/profile/${profile.username}`}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted"
                          >
                            <Avatar>
                              <AvatarImage src={profile.avatar_url} />
                              <AvatarFallback>{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium flex items-center gap-1">
                                {profile.username}
                                {profile.is_verified && (
                                  <Badge variant="secondary" className="text-xs px-1">✓</Badge>
                                )}
                              </p>
                              {profile.full_name && (
                                <p className="text-sm text-muted-foreground">{profile.full_name}</p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Posts */}
                  {results.posts.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        Posts
                      </h3>
                      <div className="grid grid-cols-3 gap-1">
                        {results.posts.slice(0, 6).map((post) => (
                          <Link key={post.id} to={`/post/${post.id}`}>
                            <div className="aspect-square bg-muted rounded overflow-hidden">
                              <ProtectedMedia
                                src={post.media_url}
                                type={post.media_type}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reels */}
                  {results.reels.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Film className="w-4 h-4" />
                        Reels
                      </h3>
                      <div className="grid grid-cols-3 gap-1">
                        {results.reels.slice(0, 6).map((reel) => (
                          <Link key={reel.id} to={`/reels?id=${reel.id}`}>
                            <div className="aspect-[9/16] bg-muted rounded overflow-hidden relative">
                              <ProtectedMedia
                                src={reel.thumbnail_url || reel.video_url}
                                type="image"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute bottom-1 left-1 flex items-center gap-1 text-white text-xs">
                                <Film className="w-3 h-3" />
                                {reel.view_count || 0}
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hashtags */}
                  {results.hashtags.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Hash className="w-4 h-4" />
                        Hashtags
                      </h3>
                      <div className="space-y-2">
                        {results.hashtags.slice(0, 5).map((hashtag) => (
                          <div
                            key={hashtag.id}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                <Hash className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium">#{hashtag.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {hashtag.post_count} posts
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {totalResults === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No results found for "{query}"</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="users" className="space-y-2">
                  {results.users.map((profile) => (
                    <Link
                      key={profile.id}
                      to={`/profile/${profile.username}`}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted"
                    >
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={profile.avatar_url} />
                        <AvatarFallback>{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium flex items-center gap-1">
                          {profile.username}
                          {profile.is_verified && (
                            <Badge variant="secondary" className="text-xs px-1">✓</Badge>
                          )}
                        </p>
                        {profile.full_name && (
                          <p className="text-sm text-muted-foreground">{profile.full_name}</p>
                        )}
                        {profile.bio && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{profile.bio}</p>
                        )}
                      </div>
                    </Link>
                  ))}
                  {results.users.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">No users found</p>
                  )}
                </TabsContent>

                <TabsContent value="posts">
                  <div className="grid grid-cols-3 gap-1">
                    {results.posts.map((post) => (
                      <Link key={post.id} to={`/post/${post.id}`}>
                        <div className="aspect-square bg-muted rounded overflow-hidden">
                          <ProtectedMedia
                            src={post.media_url}
                            type={post.media_type}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                  {results.posts.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">No posts found</p>
                  )}
                </TabsContent>

                <TabsContent value="reels">
                  <div className="grid grid-cols-3 gap-1">
                    {results.reels.map((reel) => (
                      <Link key={reel.id} to={`/reels?id=${reel.id}`}>
                        <div className="aspect-[9/16] bg-muted rounded overflow-hidden relative">
                          <ProtectedMedia
                            src={reel.thumbnail_url || reel.video_url}
                            type="image"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-1 left-1 flex items-center gap-1 text-white text-xs bg-black/50 px-1 rounded">
                            <Film className="w-3 h-3" />
                            {reel.view_count || 0}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {results.reels.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">No reels found</p>
                  )}
                </TabsContent>

                <TabsContent value="hashtags" className="space-y-2">
                  {results.hashtags.map((hashtag) => (
                    <div
                      key={hashtag.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Hash className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-medium">#{hashtag.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {hashtag.post_count} posts
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {results.hashtags.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground">No hashtags found</p>
                  )}
                </TabsContent>
              </>
            )}
          </Tabs>
        )}

        {/* Trending (when no search) */}
        {!query.trim() && !showHistory && (
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Trending
            </h3>
            <p className="text-muted-foreground text-center py-8">
              Start typing to search
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
