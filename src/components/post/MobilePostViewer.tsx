import { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Heart, MessageCircle, Send, Bookmark, ChevronDown, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ProtectedMedia } from '@/components/media/ProtectedMedia';
import { ShareSheet } from '@/components/share/ShareSheet';
import { toast } from 'sonner';

interface MobilePostViewerProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MobilePostViewer({ postId, isOpen, onClose }: MobilePostViewerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (isOpen && postId) {
      fetchPost();
    }
  }, [isOpen, postId]);

  const fetchPost = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (data) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user_id)
        .single();

      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      setPost({ ...data, profiles: profile });
      setLikesCount(count || 0);

      if (user) {
        const [{ data: likeData }, { data: saveData }] = await Promise.all([
          supabase.from('likes').select('id').eq('user_id', user.id).eq('post_id', postId).maybeSingle(),
          supabase.from('saves').select('id').eq('user_id', user.id).eq('post_id', postId).maybeSingle(),
        ]);
        setIsLiked(!!likeData);
        setIsSaved(!!saveData);
      }

      // Fetch comments
      const { data: commentsData } = await supabase
        .from('comments')
        .select('id, content, created_at, user_id')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (commentsData) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);

        const profileMap: Record<string, any> = {};
        profiles?.forEach(p => { profileMap[p.id] = p; });

        setComments(commentsData.map(c => ({
          ...c,
          profiles: profileMap[c.user_id],
        })));
      }
    }
    setLoading(false);
  };

  const handleLike = async () => {
    if (!user) return;

    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);

    if (newLiked) {
      await supabase.from('likes').insert({ user_id: user.id, post_id: postId });
    } else {
      await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const newSaved = !isSaved;
    setIsSaved(newSaved);

    if (newSaved) {
      await supabase.from('saves').insert({ user_id: user.id, post_id: postId });
      toast.success('Saved to collection');
    } else {
      await supabase.from('saves').delete().eq('user_id', user.id).eq('post_id', postId);
    }
  };

  const handleDoubleTap = () => {
    if (!isLiked) handleLike();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 1000);
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
  };

  const handleAddComment = async () => {
    if (!user || !commentText.trim()) return;

    await supabase.from('comments').insert({
      user_id: user.id,
      post_id: postId,
      content: commentText.trim(),
    });

    setCommentText('');
    fetchPost();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className="fixed inset-0 z-50 bg-background"
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <button onClick={onClose}>
            <ChevronDown className="w-6 h-6" />
          </button>
          <span className="font-semibold">Post</span>
          <button onClick={() => {}}>
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ height: 'calc(100vh - 60px)' }}>
          {loading ? (
            <div className="animate-pulse">
              <div className="aspect-square bg-muted" />
            </div>
          ) : post && (
            <>
              {/* Author */}
              <div className="flex items-center gap-3 p-4">
                <Link to={`/profile/${post.profiles?.id}`}>
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={post.profiles?.avatar_url} />
                    <AvatarFallback>{post.profiles?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <Link to={`/profile/${post.profiles?.id}`} className="font-semibold">
                  {post.profiles?.username}
                </Link>
              </div>

              {/* Media */}
              <div className="relative aspect-square" onDoubleClick={handleDoubleTap}>
                <ProtectedMedia
                  src={post.media_url}
                  type={post.media_type}
                  className="w-full h-full object-cover"
                />
                <AnimatePresence>
                  {showHeart && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <Heart className="w-24 h-24 text-white fill-white drop-shadow-lg" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={handleLike}>
                      <Heart className={cn("w-7 h-7", isLiked && "fill-destructive text-destructive")} />
                    </button>
                    <button onClick={() => setShowComments(!showComments)}>
                      <MessageCircle className="w-7 h-7" />
                    </button>
                    <button onClick={() => setShowShareSheet(true)}>
                      <Send className="w-7 h-7" />
                    </button>
                  </div>
                  <button onClick={handleSave}>
                    <Bookmark className={cn("w-7 h-7", isSaved && "fill-foreground")} />
                  </button>
                </div>

                <p className="font-semibold">{likesCount.toLocaleString()} likes</p>

                {post.caption && (
                  <p className="text-sm">
                    <span className="font-semibold mr-2">{post.profiles?.username}</span>
                    {post.caption}
                  </p>
                )}

                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                </p>
              </div>

              {/* Comments Section */}
              <AnimatePresence>
                {showComments && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="p-4 space-y-4 max-h-[300px] overflow-y-auto">
                      {comments.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={comment.profiles?.avatar_url} />
                            <AvatarFallback>{comment.profiles?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className="font-semibold mr-2">{comment.profiles?.username}</span>
                              {comment.content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Comment Input */}
                    {user && (
                      <div className="flex gap-2 p-4 border-t border-border">
                        <Input
                          placeholder="Add a comment..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                        />
                        <Button size="icon" onClick={handleAddComment} disabled={!commentText.trim()}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <ShareSheet
          open={showShareSheet}
          onOpenChange={setShowShareSheet}
          type="post"
          itemId={postId}
        />
      </motion.div>
    </AnimatePresence>
  );
}
