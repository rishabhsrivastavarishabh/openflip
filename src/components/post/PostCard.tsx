import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Post } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShareSheet } from '@/components/share/ShareSheet';
import { BlockReportSheet } from '@/components/moderation/BlockReportSheet';
import { ProtectedMedia } from '@/components/media/ProtectedMedia';
import { PostActions } from '@/components/post/PostActions';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';

interface PostCardProps {
  post: Post & {
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
  };
  onUpdate?: () => void;
}

export function PostCard({ post, onUpdate }: PostCardProps) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [isSaved, setIsSaved] = useState(post.is_saved);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [showHeart, setShowHeart] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showBlockReport, setShowBlockReport] = useState(false);

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like posts');
      return;
    }

    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);

    if (newLikedState) {
      const { error } = await supabase
        .from('likes')
        .insert({ user_id: user.id, post_id: post.id });
      
      if (error) {
        setIsLiked(!newLikedState);
        setLikesCount(prev => newLikedState ? prev - 1 : prev + 1);
        toast.error('Failed to like post');
      }
    } else {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', post.id);
      
      if (error) {
        setIsLiked(!newLikedState);
        setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);
        toast.error('Failed to unlike post');
      }
    }
  };

  const handleSave = async () => {
    if (!user) {
      toast.error('Please sign in to save posts');
      return;
    }

    const newSavedState = !isSaved;
    setIsSaved(newSavedState);

    if (newSavedState) {
      const { error } = await supabase
        .from('saves')
        .insert({ user_id: user.id, post_id: post.id });
      
      if (error) {
        setIsSaved(!newSavedState);
        toast.error('Failed to save post');
      } else {
        toast.success('Post saved');
      }
    } else {
      const { error } = await supabase
        .from('saves')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', post.id);
      
      if (error) {
        setIsSaved(!newSavedState);
        toast.error('Failed to unsave post');
      }
    }
  };

  const handleDoubleTap = () => {
    if (!isLiked) {
      handleLike();
    }
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 1000);
  };

  return (
    <article className="border-b border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link 
          to={`/profile/${post.profiles.id}`}
          className="flex items-center gap-3 group"
        >
          <Avatar className="h-9 w-9 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
            <AvatarImage src={post.profiles.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {post.profiles.username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold group-hover:text-primary transition-colors">
                {post.profiles.username}
              </span>
              {post.profiles.is_verified && <VerifiedBadge size="sm" />}
            </div>
            {post.location && (
              <span className="text-xs text-muted-foreground">{post.location}</span>
            )}
          </div>
        </Link>
        {user?.id === post.profiles.id ? (
          <PostActions postId={post.id} onDeleted={onUpdate} />
        ) : (
          <Button variant="ghost" size="icon-sm" onClick={() => setShowBlockReport(true)}>
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Media */}
      <div 
        className="relative aspect-square bg-muted cursor-pointer"
        onDoubleClick={handleDoubleTap}
      >
        <ProtectedMedia
          src={post.media_url}
          type={post.media_type}
          alt={post.caption || 'Post media'}
          className="w-full h-full object-cover"
          controls={post.media_type === 'video'}
        />
        
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <Heart className="w-24 h-24 text-primary-foreground fill-primary drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="icon" 
              size="icon-sm"
              onClick={handleLike}
              className="hover:scale-110 transition-transform"
            >
              <Heart 
                className={cn(
                  "h-6 w-6 transition-colors",
                  isLiked ? "fill-destructive text-destructive animate-heart-beat" : ""
                )}
              />
            </Button>
            <Button variant="icon" size="icon-sm" asChild>
              <Link to={`/post/${post.id}`}>
                <MessageCircle className="h-6 w-6" />
              </Link>
            </Button>
            <Button variant="icon" size="icon-sm" onClick={() => setShowShareSheet(true)}>
              <Send className="h-6 w-6" />
            </Button>
          </div>
          <Button 
            variant="icon" 
            size="icon-sm"
            onClick={handleSave}
            className="hover:scale-110 transition-transform"
          >
            <Bookmark 
              className={cn(
                "h-6 w-6 transition-colors",
                isSaved ? "fill-foreground" : ""
              )}
            />
          </Button>
        </div>

        {/* Likes count */}
        {likesCount > 0 && (
          <p className="text-sm font-semibold">
            {likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}
          </p>
        )}

        {/* Caption */}
        {post.caption && (
          <p className="text-sm">
            <Link 
              to={`/profile/${post.profiles.id}`}
              className="font-semibold hover:text-primary transition-colors mr-2"
            >
              {post.profiles.username}
            </Link>
            {post.caption}
          </p>
        )}

        {/* Comments link */}
        {post.comments_count > 0 && (
          <Link 
            to={`/post/${post.id}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all {post.comments_count} comments
          </Link>
        )}

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground uppercase">
          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
        </p>
      </div>

      {/* Share Sheet */}
      <ShareSheet
        open={showShareSheet}
        onOpenChange={setShowShareSheet}
        type="post"
        itemId={post.id}
      />

      {/* Block/Report Sheet */}
      <BlockReportSheet
        open={showBlockReport}
        onOpenChange={setShowBlockReport}
        targetUserId={post.profiles.id}
        targetUsername={post.profiles.username}
        context={{ postId: post.id }}
      />
    </article>
  );
}
