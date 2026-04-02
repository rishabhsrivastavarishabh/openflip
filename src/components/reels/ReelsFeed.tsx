import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Reel } from '@/types/database';
import { ReelCard } from './ReelCard';
import { Loader2 } from 'lucide-react';

interface ReelsFeedProps {
  initialReels?: Reel[];
}

export function ReelsFeed({ initialReels }: ReelsFeedProps) {
  const { user } = useAuth();
  const [reels, setReels] = useState<Reel[]>(initialReels || []);
  const [loading, setLoading] = useState(!initialReels);
  const [activeIndex, setActiveIndex] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialReels) {
      fetchReels();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigateToReel(activeIndex + 1);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigateToReel(activeIndex - 1);
      } else if (e.key === 'm') {
        setGlobalMuted(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, reels.length]);

  // Mouse wheel navigation (desktop)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout>;
    let isScrolling = false;

    const handleWheel = (e: WheelEvent) => {
      if (isScrolling) return;
      
      e.preventDefault();
      isScrolling = true;

      if (e.deltaY > 50) {
        navigateToReel(activeIndex + 1);
      } else if (e.deltaY < -50) {
        navigateToReel(activeIndex - 1);
      }

      scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 500);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      clearTimeout(scrollTimeout);
    };
  }, [activeIndex]);

  const navigateToReel = useCallback((index: number) => {
    if (index < 0 || index >= reels.length) return;
    
    const container = containerRef.current;
    if (!container) return;

    const itemHeight = container.clientHeight;
    container.scrollTo({
      top: index * itemHeight,
      behavior: 'smooth',
    });
    setActiveIndex(index);
  }, [reels.length]);

  const fetchReels = async () => {
    setLoading(true);
    try {
      const { data: reelsData, error } = await supabase
        .from('reels')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get profiles
      const userIds = [...new Set(reelsData?.map(r => r.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, is_verified')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Get like counts and user likes
      const reelIds = reelsData?.map(r => r.id) || [];
      
      const { data: likeCounts } = await supabase
        .from('reel_likes')
        .select('reel_id')
        .in('reel_id', reelIds);

      const likeCountMap = new Map<string, number>();
      likeCounts?.forEach(l => {
        likeCountMap.set(l.reel_id, (likeCountMap.get(l.reel_id) || 0) + 1);
      });

      let userLikes = new Set<string>();
      if (user) {
        const { data: userLikesData } = await supabase
          .from('reel_likes')
          .select('reel_id')
          .eq('user_id', user.id)
          .in('reel_id', reelIds);
        userLikes = new Set(userLikesData?.map(l => l.reel_id) || []);
      }

      // Get comment counts
      const { data: commentCounts } = await supabase
        .from('reel_comments')
        .select('reel_id')
        .in('reel_id', reelIds);

      const commentCountMap = new Map<string, number>();
      commentCounts?.forEach(c => {
        commentCountMap.set(c.reel_id, (commentCountMap.get(c.reel_id) || 0) + 1);
      });

      const enrichedReels = reelsData?.map(reel => ({
        ...reel,
        profiles: profilesMap.get(reel.user_id) as any,
        isLiked: userLikes.has(reel.id),
        likeCount: likeCountMap.get(reel.id) || 0,
        commentCount: commentCountMap.get(reel.id) || 0,
      })) || [];

      setReels(enrichedReels as Reel[]);
    } catch (error) {
      console.error('Error fetching reels:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const scrollPosition = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollPosition / itemHeight);
    
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < reels.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, reels.length]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white gap-4">
        <p className="text-lg">No reels yet</p>
        <p className="text-muted-foreground">Be the first to post a reel!</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
      onScroll={handleScroll}
    >
      {reels.map((reel, index) => (
        <div key={reel.id} className="w-full h-full">
          <ReelCard
            reel={reel}
            isActive={index === activeIndex}
            onLike={() => {}}
            globalMuted={globalMuted}
            onMuteToggle={() => setGlobalMuted(prev => !prev)}
          />
        </div>
      ))}
    </div>
  );
}
