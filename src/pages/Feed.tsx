import { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PostCard } from '@/components/post/PostCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface FeedPost {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string;
  media_type: 'image' | 'video';
  location: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_saved: boolean;
}

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const fetchPosts = useCallback(async (pageNum: number) => {
    const limit = 10;
    const offset = pageNum * limit;

    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles!inner(id, username, avatar_url, is_verified)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // If user is logged in, show posts from followed users + own posts
    if (user) {
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = following?.map(f => f.following_id) || [];
      followingIds.push(user.id);

      if (followingIds.length > 0) {
        query = query.in('user_id', followingIds);
      }
    }

    const { data: postsData, error } = await query;

    if (error) {
      console.error('Error fetching posts:', error);
      setLoading(false);
      return;
    }

    if (!postsData || postsData.length === 0) {
      if (pageNum === 0) {
        // No posts at all, fetch explore posts instead
        const { data: explorePosts } = await supabase
          .from('posts')
          .select(`
            *,
            profiles!inner(id, username, avatar_url, is_verified)
          `)
          .order('created_at', { ascending: false })
          .limit(20);

        if (explorePosts && explorePosts.length > 0) {
          const enrichedPosts = await enrichPosts(explorePosts);
          setPosts(enrichedPosts);
        }
      }
      setHasMore(false);
      setLoading(false);
      return;
    }

    const enrichedPosts = await enrichPosts(postsData);

    if (pageNum === 0) {
      setPosts(enrichedPosts);
    } else {
      setPosts(prev => [...prev, ...enrichedPosts]);
    }

    setHasMore(postsData.length === limit);
    setLoading(false);
  }, [user]);

  const enrichPosts = async (postsData: any[]): Promise<FeedPost[]> => {
    const postIds = postsData.map(p => p.id);

    // Get likes counts
    const { data: likesData } = await supabase
      .from('likes')
      .select('post_id')
      .in('post_id', postIds);

    const likesCounts: Record<string, number> = {};
    likesData?.forEach(like => {
      likesCounts[like.post_id] = (likesCounts[like.post_id] || 0) + 1;
    });

    // Get comments counts
    const { data: commentsData } = await supabase
      .from('comments')
      .select('post_id')
      .in('post_id', postIds);

    const commentsCounts: Record<string, number> = {};
    commentsData?.forEach(comment => {
      commentsCounts[comment.post_id] = (commentsCounts[comment.post_id] || 0) + 1;
    });

    // Get user's likes and saves if logged in
    let userLikes: string[] = [];
    let userSaves: string[] = [];

    if (user) {
      const { data: likes } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);

      userLikes = likes?.map(l => l.post_id) || [];

      const { data: saves } = await supabase
        .from('saves')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);

      userSaves = saves?.map(s => s.post_id) || [];
    }

    return postsData.map(post => ({
      ...post,
      likes_count: likesCounts[post.id] || 0,
      comments_count: commentsCounts[post.id] || 0,
      is_liked: userLikes.includes(post.id),
      is_saved: userSaves.includes(post.id),
    }));
  };

  useEffect(() => {
    fetchPosts(0);
  }, [fetchPosts]);

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-4 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">O</span>
              </div>
              <span className="text-xl font-display font-bold gradient-text">Openflip</span>
            </div>
          </div>
        </header>

        {/* Feed */}
        <div className="divide-y divide-border">
          {loading && posts.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="aspect-square w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))
          ) : posts.length > 0 ? (
            <>
              {posts.map(post => (
                <PostCard key={post.id} post={post as any} onUpdate={() => fetchPosts(0)} />
              ))}
              {hasMore && (
                <div className="p-4 text-center">
                  <Button variant="ghost" onClick={loadMore} disabled={loading}>
                    {loading ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No posts yet</h3>
              <p className="text-muted-foreground mb-4">
                Follow some users to see their posts here, or create your first post!
              </p>
              <div className="flex gap-2 justify-center">
                <Button asChild variant="gradient">
                  <Link to="/create">Create Post</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/explore">Explore</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
