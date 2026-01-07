import { useEffect, useState, useCallback, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PostCard } from '@/components/post/PostCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera, RefreshCw, Search, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { CreateStory } from '@/components/stories/CreateStory';
import { StoryGroup } from '@/types/database';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
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
  const {
    user
  } = useAuth();
  const {
    unreadNotifications
  } = useUnreadCounts();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [viewingStory, setViewingStory] = useState<StoryGroup | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const PULL_THRESHOLD = 80;
  const fetchPosts = useCallback(async (pageNum: number) => {
    const limit = 10;
    const offset = pageNum * limit;

    // Get user's following list if logged in
    let followingIds: string[] = [];
    if (user) {
      const {
        data: following
      } = await supabase.from('follows').select('following_id').eq('follower_id', user.id);
      followingIds = following?.map(f => f.following_id) || [];
      followingIds.push(user.id);
    }

    // Fetch posts - only from followed users + own posts, images only (videos go to Reels)
    let query = supabase.from('posts').select('*').eq('media_type', 'image').order('created_at', {
      ascending: false
    }).range(offset, offset + limit - 1);
    if (user && followingIds.length > 0) {
      query = query.in('user_id', followingIds);
    }
    const {
      data: postsData,
      error
    } = await query;
    if (error) {
      console.error('Error fetching posts:', error);
      setLoading(false);
      return;
    }
    if (!postsData || postsData.length === 0) {
      if (pageNum === 0) {
        // No posts from following, fetch explore posts instead (images only)
        const {
          data: explorePosts
        } = await supabase.from('posts').select('*').eq('media_type', 'image').order('created_at', {
          ascending: false
        }).limit(20);
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
    const userIds = [...new Set(postsData.map(p => p.user_id))];

    // Get profiles for all post authors
    const {
      data: profilesData
    } = await supabase.from('profiles').select('id, username, avatar_url, is_verified').in('id', userIds);
    const profilesMap: Record<string, any> = {};
    profilesData?.forEach(p => {
      profilesMap[p.id] = p;
    });

    // Get likes counts
    const {
      data: likesData
    } = await supabase.from('likes').select('post_id').in('post_id', postIds);
    const likesCounts: Record<string, number> = {};
    likesData?.forEach(like => {
      likesCounts[like.post_id] = (likesCounts[like.post_id] || 0) + 1;
    });

    // Get comments counts
    const {
      data: commentsData
    } = await supabase.from('comments').select('post_id').in('post_id', postIds);
    const commentsCounts: Record<string, number> = {};
    commentsData?.forEach(comment => {
      commentsCounts[comment.post_id] = (commentsCounts[comment.post_id] || 0) + 1;
    });

    // Get user's likes and saves if logged in
    let userLikes: string[] = [];
    let userSaves: string[] = [];
    if (user) {
      const {
        data: likes
      } = await supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds);
      userLikes = likes?.map(l => l.post_id) || [];
      const {
        data: saves
      } = await supabase.from('saves').select('post_id').eq('user_id', user.id).in('post_id', postIds);
      userSaves = saves?.map(s => s.post_id) || [];
    }
    return postsData.map(post => ({
      ...post,
      profiles: profilesMap[post.user_id] || {
        id: post.user_id,
        username: 'Unknown',
        avatar_url: null,
        is_verified: false
      },
      likes_count: likesCounts[post.id] || 0,
      comments_count: commentsCounts[post.id] || 0,
      is_liked: userLikes.includes(post.id),
      is_saved: userSaves.includes(post.id)
    }));
  };
  useEffect(() => {
    fetchPosts(0);
  }, [fetchPosts]);
  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage).finally(() => setLoadingMore(false));
    }
  }, [loading, loadingMore, hasMore, page, fetchPosts]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        loadMore();
      }
    }, {
      threshold: 0.1
    });
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMore]);

  // Pull-to-refresh handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0 && containerRef.current?.scrollTop === 0) {
      e.preventDefault();
      setPullDistance(Math.min(diff * 0.5, PULL_THRESHOLD * 1.5));
    }
  }, [refreshing]);
  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD);

      // Reset and refetch
      setPage(0);
      await fetchPosts(0);
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, refreshing, fetchPosts]);
  return <MainLayout>
      <div ref={containerRef} className="max-w-lg mx-auto relative" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {/* Pull-to-refresh indicator */}
        <div className="absolute left-0 right-0 flex justify-center z-50 transition-transform duration-200" style={{
        transform: `translateY(${pullDistance - 40}px)`,
        opacity: pullDistance / PULL_THRESHOLD
      }}>
          <div className={`w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
            <RefreshCw className="w-5 h-5 text-primary" style={{
            transform: refreshing ? 'none' : `rotate(${pullDistance * 3}deg)`
          }} />
          </div>
        </div>

        {/* Content wrapper with pull offset */}
        <div style={{
        transform: `translateY(${pullDistance}px)`,
        transition: pullDistance === 0 ? 'transform 0.2s' : 'none'
      }}>
        {/* Header */}
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-4 md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">O</span>
              </div>
              <span className="text-xl font-display font-bold gradient-text">Openflip</span>
            </div>
            <div className="flex items-center gap-1">
              <Link to="/reels">
                <Button variant="ghost" size="icon" className="relative">
                  
                </Button>
              </Link>
              <Link to="/explore">
                <Button variant="ghost" size="icon">
                  <Search className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/notifications">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadNotifications > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>}
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Stories Bar */}
        <StoriesBar onViewStory={storyGroup => setViewingStory(storyGroup)} onCreateStory={() => setShowCreateStory(true)} />

        {/* Story Viewer Modal */}
        {viewingStory && <StoryViewer storyGroups={[viewingStory]} initialGroupIndex={0} onClose={() => setViewingStory(null)} />}

        {/* Create Story Modal */}
        {showCreateStory && <CreateStory onClose={() => setShowCreateStory(false)} onCreated={() => setShowCreateStory(false)} />}

        {/* Feed */}
        <div className="divide-y divide-border">
          {loading && posts.length === 0 ? Array.from({
            length: 3
          }).map((_, i) => <div key={i} className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="aspect-square w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>) : posts.length > 0 ? <>
              {posts.map(post => <PostCard key={post.id} post={post as any} onUpdate={() => fetchPosts(0)} />)}
              {hasMore && <div ref={loadMoreRef} className="p-4 text-center">
                  {loadingMore && <div className="flex justify-center">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>}
                </div>}
            </> : <div className="p-8 text-center">
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
            </div>}
        </div>
        </div> {/* End content wrapper */}
      </div>
    </MainLayout>;
}