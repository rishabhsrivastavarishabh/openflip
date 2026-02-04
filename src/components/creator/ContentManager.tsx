import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  ArrowLeft, Eye, Heart, MessageCircle, Share2, Bookmark,
  UserPlus, TrendingUp, Play, Image, Loader2, MoreVertical,
  Pin, Trash2, Pencil, Rocket
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ContentManagerProps {
  onBack: () => void;
  onBoost?: (contentType: string, contentId: string) => void;
}

interface ContentItem {
  id: string;
  type: 'post' | 'reel';
  media_url: string;
  caption: string | null;
  created_at: string;
  is_pinned?: boolean;
  likes: number;
  comments: number;
  saves: number;
  views?: number;
}

export function ContentManager({ onBack, onBoost }: ContentManagerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels'>('posts');
  const [posts, setPosts] = useState<ContentItem[]>([]);
  const [reels, setReels] = useState<ContentItem[]>([]);

  useEffect(() => {
    if (user) {
      fetchContent();
    }
  }, [user]);

  const fetchContent = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch posts with engagement counts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, media_url, caption, created_at, is_pinned')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Fetch engagement for each post
      const postsWithEngagement = await Promise.all(
        (postsData || []).map(async (post) => {
          const [likesRes, commentsRes, savesRes] = await Promise.all([
            supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
            supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
            supabase.from('saves').select('*', { count: 'exact', head: true }).eq('post_id', post.id),
          ]);

          return {
            ...post,
            type: 'post' as const,
            likes: likesRes.count || 0,
            comments: commentsRes.count || 0,
            saves: savesRes.count || 0,
          };
        })
      );

      setPosts(postsWithEngagement);

      // Fetch reels with engagement counts
      const { data: reelsData, error: reelsError } = await supabase
        .from('reels')
        .select('id, video_url, caption, created_at, view_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (reelsError) throw reelsError;

      // Fetch engagement for each reel
      const reelsWithEngagement = await Promise.all(
        (reelsData || []).map(async (reel) => {
          const [likesRes, commentsRes, savesRes] = await Promise.all([
            supabase.from('reel_likes').select('*', { count: 'exact', head: true }).eq('reel_id', reel.id),
            supabase.from('reel_comments').select('*', { count: 'exact', head: true }).eq('reel_id', reel.id),
            supabase.from('reel_saves').select('*', { count: 'exact', head: true }).eq('reel_id', reel.id),
          ]);

          return {
            id: reel.id,
            type: 'reel' as const,
            media_url: reel.video_url,
            caption: reel.caption,
            created_at: reel.created_at,
            views: reel.view_count || 0,
            likes: likesRes.count || 0,
            comments: commentsRes.count || 0,
            saves: savesRes.count || 0,
          };
        })
      );

      setReels(reelsWithEngagement);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const handlePin = async (postId: string, isPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_pinned: !isPinned })
        .eq('id', postId);

      if (error) throw error;

      setPosts(prev =>
        prev.map(p => (p.id === postId ? { ...p, is_pinned: !isPinned } : p))
      );
      toast.success(isPinned ? 'Post unpinned' : 'Post pinned to profile');
    } catch (error) {
      console.error('Error pinning post:', error);
      toast.error('Failed to update pin status');
    }
  };

  const handleDelete = async (type: 'post' | 'reel', id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      const table = type === 'post' ? 'posts' : 'reels';
      const { error } = await supabase.from(table).delete().eq('id', id);

      if (error) throw error;

      if (type === 'post') {
        setPosts(prev => prev.filter(p => p.id !== id));
      } else {
        setReels(prev => prev.filter(r => r.id !== id));
      }
      toast.success(`${type === 'post' ? 'Post' : 'Reel'} deleted`);
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete');
    }
  };

  const currentContent = activeTab === 'posts' ? posts : reels;

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Content Manager</h1>
        </header>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">Content Manager</h1>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-secondary/50 text-center">
          <Image className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold">{posts.length}</p>
          <p className="text-sm text-muted-foreground">Posts</p>
        </div>
        <div className="p-4 rounded-xl bg-secondary/50 text-center">
          <Play className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-2xl font-bold">{reels.length}</p>
          <p className="text-sm text-muted-foreground">Reels</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="posts" className="gap-2">
            <Image className="w-4 h-4" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="reels" className="gap-2">
            <Play className="w-4 h-4" />
            Reels
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content Grid */}
      <div className="space-y-3">
        {currentContent.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex gap-3 p-3 rounded-xl bg-secondary/50"
          >
            {/* Thumbnail */}
            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {item.type === 'post' ? (
                <img
                  src={item.media_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black">
                  <Play className="w-8 h-8 text-white" />
                </div>
              )}
              {item.is_pinned && (
                <Badge className="absolute top-1 left-1 p-1" variant="default">
                  <Pin className="w-3 h-3" />
                </Badge>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-2">
                {item.caption || 'No caption'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(item.created_at), 'MMM d, yyyy')}
              </p>
              
              {/* Engagement Stats */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" /> {item.likes}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> {item.comments}
                </span>
                <span className="flex items-center gap-1">
                  <Bookmark className="w-3 h-3" /> {item.saves}
                </span>
                {item.views !== undefined && (
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {item.views}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/post/${item.id}`)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </DropdownMenuItem>
                {item.type === 'post' && (
                  <DropdownMenuItem onClick={() => handlePin(item.id, item.is_pinned || false)}>
                    <Pin className="w-4 h-4 mr-2" />
                    {item.is_pinned ? 'Unpin' : 'Pin to Profile'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onBoost?.(item.type, item.id)}>
                  <Rocket className="w-4 h-4 mr-2" />
                  Boost
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleDelete(item.type, item.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        ))}

        {currentContent.length === 0 && (
          <div className="text-center py-12">
            {activeTab === 'posts' ? (
              <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            ) : (
              <Play className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            )}
            <p className="text-muted-foreground">
              No {activeTab} yet
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => navigate('/create')}
            >
              Create your first {activeTab === 'posts' ? 'post' : 'reel'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
