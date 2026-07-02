import { useEffect, useState, useCallback, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Seo } from '@/components/seo/Seo';

import { PostCard } from '@/components/post/PostCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Camera, RefreshCw, Search, Bell, Play, Heart, MessageCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { StoriesBar } from '@/components/stories/StoriesBar';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { CreateStory } from '@/components/stories/CreateStory';
import { StoryGroup } from '@/types/database';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { SuggestedUsers } from '@/components/feed/SuggestedUsers';
import { SuggestedPosts } from '@/components/feed/SuggestedPosts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import openflipLogo from '@/assets/openflip-logo.png';

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
  is_suggested?: boolean;
}

interface FeedReel {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  view_count: number;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  likes_count: number;
  comments_count: number;
  type: 'reel';
}

type FeedItem = (FeedPost & { type?: 'post' }) | FeedReel;

export default function FeedPage() {
  const { user } = useAuth();
  const { unreadNotifications } = useUnreadCounts();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
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

  const enrichPosts = useCallback(async (postsData: any[]): Promise<FeedPost[]> => {
    const postIds = postsData.map(p => p.id);
    const userIds = [...new Set(postsData.map(p => p.user_id))];

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, is_verified')
      .in('id', userIds);
    const profilesMap: Record<string, any> = {};
    profilesData?.forEach(p => { profilesMap[p.id] = p; });

    const { data: likesData } = await supabase
      .from('likes')
      .select('post_id')
      .in('post_id', postIds);
    const likesCounts: Record<string, number> = {};
    likesData?.forEach(like => { likesCounts[like.post_id] = (likesCounts[like.post_id] || 0) + 1; });

    const { data: commentsData } = await supabase
      .from('comments')
      .select('post_id')
      .in('post_id', postIds);
    const commentsCounts: Record<string, number> = {};
    commentsData?.forEach(comment => { commentsCounts[comment.post_id] = (commentsCounts[comment.post_id] || 0) + 1; });

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
      profiles: profilesMap[post.user_id] || {
        id: post.user_id,
        username: 'Unknown',
        avatar_url: null,
        is_verified: false
      },
      likes_count: likesCounts[post.id] || 0,
      comments_count: commentsCounts[post.id] || 0,
      is_liked: userLikes.includes(post.id),
      is_saved: userSaves.includes(post.id),
      is_suggested: post.is_suggested || false,
    }));
  }, [user]);

  const fetchPosts = useCallback(async (pageNum: number) => {
    const limit = 10;
    const offset = pageNum * limit;

    let followingIds: string[] = [];
    if (user) {
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      followingIds = following?.map(f => f.following_id) || [];
      followingIds.push(user.id);
    }

    let followedPosts: any[] = [];
    let suggestedPosts: any[] = [];

    if (user && followingIds.length > 0) {
      const { data: followedData } = await supabase
        .from('posts')
        .select('*')
        .eq('media_type', 'image')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      followedPosts = followedData || [];
    }

    const suggestedLimit = Math.max(3, Math.floor(limit * 0.4));
    if (user && followingIds.length > 0) {
      const { data: suggestedData } = await supabase
        .from('posts')
        .select('*')
        .eq('media_type', 'image')
        .not('user_id', 'in', `(${followingIds.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(suggestedLimit * 4);

      // Rank candidates: engagement + recency decay (client-side heuristic)
      const candidates = suggestedData || [];
      if (candidates.length > 0) {
        const cIds = candidates.map((p: any) => p.id);
        const [{ data: cLikes }, { data: cComments }] = await Promise.all([
          supabase.from('likes').select('post_id').in('post_id', cIds),
          supabase.from('comments').select('post_id').in('post_id', cIds),
        ]);
        const lc: Record<string, number> = {};
        const cc: Record<string, number> = {};
        cLikes?.forEach((l: any) => { lc[l.post_id] = (lc[l.post_id] || 0) + 1; });
        cComments?.forEach((c: any) => { cc[c.post_id] = (cc[c.post_id] || 0) + 1; });
        const scored = candidates.map((p: any) => {
          const engagement = (lc[p.id] || 0) + (cc[p.id] || 0) * 2;
          const ageH = (Date.now() - new Date(p.created_at).getTime()) / 36e5;
          const decay = 1 / (1 + ageH / 48);
          return { ...p, _score: engagement * decay + Math.log(engagement + 1) };
        });
        scored.sort((a: any, b: any) => b._score - a._score);
        suggestedPosts = scored.slice(0, suggestedLimit).map((p: any) => ({ ...p, is_suggested: true }));
      }
    }

    let combinedPosts = [...followedPosts];
    suggestedPosts.forEach((suggestedPost, index) => {
      const insertPosition = Math.min((index + 1) * 3, combinedPosts.length);
      combinedPosts.splice(insertPosition, 0, suggestedPost);
    });

    if (combinedPosts.length === 0 && pageNum === 0) {
      const { data: explorePosts } = await supabase
        .from('posts')
        .select('*')
        .eq('media_type', 'image')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (explorePosts && explorePosts.length > 0) {
        const enrichedPosts = await enrichPosts(explorePosts.map(p => ({ ...p, is_suggested: true })));
        setFeedItems(enrichedPosts.map(p => ({ ...p, type: 'post' as const })));
      }
      setHasMore(false);
      setLoading(false);
      return;
    }

    // Fetch some reels to mix in
    let reels: FeedReel[] = [];
    if (pageNum === 0) {
      const { data: reelsData } = await supabase
        .from('reels')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (reelsData && reelsData.length > 0) {
        const reelUserIds = [...new Set(reelsData.map(r => r.user_id))];
        const { data: reelProfiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_verified')
          .in('id', reelUserIds);
        
        const reelProfilesMap: Record<string, any> = {};
        reelProfiles?.forEach(p => { reelProfilesMap[p.id] = p; });

        const reelIds = reelsData.map(r => r.id);
        const { data: reelLikes } = await (supabase as any)
          .from('reel_likes')
          .select('reel_id')
          .in('reel_id', reelIds);
        const { data: reelComments } = await (supabase as any)
          .from('reel_comments')
          .select('reel_id')
          .in('reel_id', reelIds);

        const reelLikesCounts: Record<string, number> = {};
        const reelCommentsCounts: Record<string, number> = {};
        reelLikes?.forEach((l: any) => { reelLikesCounts[l.reel_id] = (reelLikesCounts[l.reel_id] || 0) + 1; });
        reelComments?.forEach((c: any) => { reelCommentsCounts[c.reel_id] = (reelCommentsCounts[c.reel_id] || 0) + 1; });

        reels = reelsData.map(r => ({
          id: r.id,
          user_id: r.user_id,
          video_url: r.video_url,
          thumbnail_url: r.thumbnail_url,
          caption: r.caption,
          view_count: r.view_count || 0,
          created_at: r.created_at || '',
          profiles: reelProfilesMap[r.user_id] || { id: r.user_id, username: 'Unknown', avatar_url: null, is_verified: false },
          likes_count: reelLikesCounts[r.id] || 0,
          comments_count: reelCommentsCounts[r.id] || 0,
          type: 'reel' as const,
        }));
      }
    }

    const enrichedPosts = await enrichPosts(combinedPosts);
    const postsWithType = enrichedPosts.map(p => ({ ...p, type: 'post' as const }));

    let mixedFeed: FeedItem[] = [...postsWithType];
    reels.forEach((reel, index) => {
      const insertPosition = Math.min((index + 1) * 4, mixedFeed.length);
      mixedFeed.splice(insertPosition, 0, reel);
    });

    if (pageNum === 0) {
      setFeedItems(mixedFeed);
    } else {
      setFeedItems(prev => [...prev, ...postsWithType]);
    }
    setHasMore(followedPosts.length === limit);
    setLoading(false);
  }, [user, enrichPosts]);

  useEffect(() => {
    fetchPosts(0);
  }, [fetchPosts]);

  // Realtime: prepend new posts and reels as they are published
  useEffect(() => {
    const channel = supabase
      .channel('feed-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        fetchPosts(0);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reels' }, () => {
        fetchPosts(0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const loadMore = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPosts(nextPage).finally(() => setLoadingMore(false));
    }
  }, [loading, loadingMore, hasMore, page, fetchPosts]);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        loadMore();
      }
    }, { threshold: 0.1 });
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMore]);

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
      setPage(0);
      await fetchPosts(0);
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, refreshing, fetchPosts]);

  const renderReelCard = (reel: FeedReel) => (
    <Link
      key={reel.id}
      to={`/reels?id=${reel.id}`}
      className="block border-b border-border"
    >
      <div className="p-3 flex items-center gap-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={reel.profiles.avatar_url || undefined} />
          <AvatarFallback>{reel.profiles.username.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="font-medium text-sm flex items-center gap-1">
          {reel.profiles.username}
          {reel.profiles.is_verified && <VerifiedBadge size="sm" />}
        </span>
        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-auto">Reel</span>
      </div>
      <div className="relative aspect-[9/16] max-h-[500px] bg-black">
        {reel.thumbnail_url ? (
          <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <video src={reel.video_url} className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white" />
          </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-white text-sm line-clamp-2 drop-shadow-lg">{reel.caption}</p>
        </div>
      </div>
      <div className="p-3 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Heart className="w-4 h-4" /> {reel.likes_count}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="w-4 h-4" /> {reel.comments_count}
        </span>
        <span className="flex items-center gap-1">
          <Play className="w-4 h-4" /> {reel.view_count}
        </span>
      </div>
    </Link>
  );

  return (
    <MainLayout>
      <Seo
        title="Openflip — Photo & short‑video social network"
        description="Share photos and short videos, follow creators, and discover trending content on Openflip."
        path="/"
      />
      <h1 className="sr-only">Openflip — your photo and short‑video feed</h1>
      <div
        ref={containerRef}
        className="w-full max-w-lg mx-auto relative overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}

        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="absolute left-0 right-0 flex justify-center z-50 transition-transform duration-200"
          style={{
            transform: `translateY(${pullDistance - 40}px)`,
            opacity: pullDistance / PULL_THRESHOLD
          }}
        >
          <div className={`w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
            <RefreshCw
              className="w-5 h-5 text-primary"
              style={{ transform: refreshing ? 'none' : `rotate(${pullDistance * 3}deg)` }}
            />
          </div>
        </div>

        <div style={{ transform: `translateY(${pullDistance}px)`, transition: pullDistance === 0 ? 'transform 0.2s' : 'none' }}>
          {/* Header */}
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-4 md:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={openflipLogo} alt="Openflip - Secure Social Media" fetchPriority="high" decoding="async" className="w-8 h-8 rounded-lg object-cover" />
                <span className="text-xl font-display font-bold gradient-text">Openflip</span>
              </div>
              <div className="flex items-center gap-1">
                <Link to="/search" aria-label="Search">
                  <Button variant="ghost" size="icon" aria-label="Search">
                    <Search aria-hidden="true" className="w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/notifications" aria-label="Notifications">
                  <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                    <Bell aria-hidden="true" className="w-5 h-5" />
                    {unreadNotifications > 0 && (
                      <span aria-label={`${unreadNotifications} unread notifications`} className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </span>
                    )}
                  </Button>
                </Link>
              </div>
            </div>
          </header>

          <StoriesBar
            onViewStory={storyGroup => setViewingStory(storyGroup)}
            onCreateStory={() => setShowCreateStory(true)}
          />

          <SuggestedUsers />
          <SuggestedPosts />

          {viewingStory && (
            <StoryViewer
              storyGroups={[viewingStory]}
              initialGroupIndex={0}
              onClose={() => setViewingStory(null)}
            />
          )}

          {showCreateStory && (
            <CreateStory
              onClose={() => setShowCreateStory(false)}
              onCreated={() => setShowCreateStory(false)}
            />
          )}

          <div className="divide-y divide-border">
            {loading && feedItems.length === 0 ? (
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
            ) : feedItems.length > 0 ? (
              <>
                {feedItems.map(item =>
                  item.type === 'reel' ? (
                    renderReelCard(item as FeedReel)
                  ) : (
                    <PostCard key={item.id} post={item as any} onUpdate={() => fetchPosts(0)} />
                  )
                )}
                {hasMore && (
                  <div ref={loadMoreRef} className="p-4 text-center">
                    {loadingMore && (
                      <div className="flex justify-center">
                        <LoadingSpinner size="sm" />
                      </div>
                    )}
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
      </div>
    </MainLayout>
  );
}
