import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ScoredPost {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  score: number;
  profiles: {
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

/**
 * Score = engagement (likes*1 + comments*2) * recency-decay
 * recency-decay = 1 / (1 + hours_since_post / 48)  (half-weight after 2 days)
 */
function scorePost(likes: number, comments: number, createdAt: string): number {
  const engagement = likes + comments * 2;
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / 36e5;
  const decay = 1 / (1 + ageHours / 48);
  return engagement * decay + Math.log(engagement + 1);
}

export function SuggestedPosts() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ScoredPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        let followingIds: string[] = [];
        if (user) {
          const { data: following } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id);
          followingIds = following?.map(f => f.following_id) || [];
          followingIds.push(user.id);
        }

        let query = supabase
          .from('posts')
          .select('id, user_id, media_url, media_type, caption, created_at')
          .eq('media_type', 'image')
          .order('created_at', { ascending: false })
          .limit(40);

        if (followingIds.length > 0) {
          query = query.not('user_id', 'in', `(${followingIds.join(',')})`);
        }
        const { data: postsData } = await query;
        if (!postsData || postsData.length === 0) {
          setLoading(false);
          return;
        }

        const postIds = postsData.map(p => p.id);
        const userIds = [...new Set(postsData.map(p => p.user_id))];

        const [{ data: likesData }, { data: commentsData }, { data: profs }] = await Promise.all([
          supabase.from('likes').select('post_id').in('post_id', postIds),
          supabase.from('comments').select('post_id').in('post_id', postIds),
          supabase.from('profiles').select('id, username, avatar_url, is_verified').in('id', userIds),
        ]);

        const lc: Record<string, number> = {};
        const cc: Record<string, number> = {};
        likesData?.forEach((l: any) => { lc[l.post_id] = (lc[l.post_id] || 0) + 1; });
        commentsData?.forEach((c: any) => { cc[c.post_id] = (cc[c.post_id] || 0) + 1; });
        const pmap: Record<string, any> = {};
        profs?.forEach((p: any) => { pmap[p.id] = p; });

        const scored: ScoredPost[] = postsData.map(p => ({
          ...p,
          likes_count: lc[p.id] || 0,
          comments_count: cc[p.id] || 0,
          score: scorePost(lc[p.id] || 0, cc[p.id] || 0, p.created_at || new Date().toISOString()),
          profiles: pmap[p.user_id] || { username: 'user', avatar_url: null, is_verified: false },
        }));

        scored.sort((a, b) => b.score - a.score);
        setPosts(scored.slice(0, 10));
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="py-4 border-b border-border">
        <div className="px-4 mb-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-3 px-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="w-40 h-52 rounded-xl flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className="py-4 border-b border-border/60" aria-label="Suggested posts">
      <div className="flex items-center gap-2 px-4 mb-3">
        <div className="w-6 h-6 rounded-lg gradient-primary flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-primary-foreground" aria-hidden />
        </div>
        <h3 className="font-semibold text-sm tracking-tight">Suggested for you</h3>
      </div>
      <ScrollArea className="w-full">
        <div className="flex gap-3 px-4 pb-2 snap-x snap-mandatory">
          {posts.map(p => (
            <Link
              key={p.id}
              to={`/post/${p.id}`}
              className="flex-shrink-0 w-40 rounded-2xl overflow-hidden border border-border/60 bg-card shadow-sm hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 transition-all snap-start"
            >
              <div className="aspect-square bg-muted">
                <img
                  src={p.media_url}
                  alt={p.caption || `Post by ${p.profiles.username}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-2 space-y-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={p.profiles.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {p.profiles.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium truncate">{p.profiles.username}</span>
                  {p.profiles.is_verified && <VerifiedBadge size="sm" />}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{p.likes_count}</span>
                  <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{p.comments_count}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}
