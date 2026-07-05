import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Send, Bookmark, MoreHorizontal, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Seo } from '@/components/seo/Seo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { ShareSheet } from '@/components/share/ShareSheet';
import { BlockReportSheet } from '@/components/moderation/BlockReportSheet';
import { ProtectedMedia } from '@/components/media/ProtectedMedia';
import { useFollowRelationship } from '@/hooks/useFollowRelationship';
import { PostActions } from '@/components/post/PostActions';

interface PostData {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string;
  media_type: 'image' | 'video';
  location: string | null;
  created_at: string;
  profiles: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

interface CommentData {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profiles: {
    id: string;
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  replies?: CommentData[];
}

export default function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [post, setPost] = useState<PostData | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showBlockReport, setShowBlockReport] = useState(false);
  const [expandedCaption, setExpandedCaption] = useState(false);

  const { isFollowing, loading: followLoading, refresh: refreshFollow } = useFollowRelationship(post?.user_id || '');
  const isOwnPost = user?.id === post?.user_id;
  const [followActionLoading, setFollowActionLoading] = useState(false);

  const handleFollow = async () => {
    if (!user || !post) return;
    setFollowActionLoading(true);
    
    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id)
        .eq('following_id', post.user_id);
    } else {
      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: post.user_id,
      });
      // Create notification
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        actor_id: user.id,
        type: 'follow',
      });
    }
    
    await refreshFollow();
    setFollowActionLoading(false);
  };

  useEffect(() => {
    if (postId) {
      fetchPost();
      fetchComments();
    }
  }, [postId]);

  useEffect(() => {
    if (postId && user) {
      checkUserInteractions();
    }
  }, [postId, user]);

  const fetchPost = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (error) {
      console.error('Error fetching post:', error);
      setLoading(false);
      return;
    }

    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_verified')
      .eq('id', data.user_id)
      .single();

    // Fetch likes count
    const { count: likesData } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);

    setPost({
      ...data,
      media_type: data.media_type as 'image' | 'video',
      profiles: profileData || { id: data.user_id, username: 'Unknown', full_name: null, avatar_url: null, is_verified: false },
    });
    setLikesCount(likesData || 0);
    setLoading(false);
  };

  const fetchComments = async () => {
    const { data: commentsData } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, parent_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (!commentsData) return;

    // Fetch profiles for all commenters
    const userIds = [...new Set(commentsData.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, is_verified')
      .in('id', userIds);

    const profileMap: Record<string, any> = {};
    profiles?.forEach(p => {
      profileMap[p.id] = p;
    });

    const enrichedComments = commentsData.map(c => ({
      ...c,
      profiles: profileMap[c.user_id] || { id: c.user_id, username: 'Unknown', avatar_url: null, is_verified: false },
    }));

    // Organize into parent-child structure
    const parentComments: CommentData[] = [];
    const repliesMap: Record<string, CommentData[]> = {};

    enrichedComments.forEach(comment => {
      if (comment.parent_id) {
        if (!repliesMap[comment.parent_id]) {
          repliesMap[comment.parent_id] = [];
        }
        repliesMap[comment.parent_id].push(comment);
      } else {
        parentComments.push(comment);
      }
    });

    parentComments.forEach(parent => {
      parent.replies = repliesMap[parent.id] || [];
    });

    setComments(parentComments);
  };

  const checkUserInteractions = async () => {
    if (!user || !postId) return;

    const [{ data: likeData }, { data: saveData }] = await Promise.all([
      supabase.from('likes').select('id').eq('user_id', user.id).eq('post_id', postId).maybeSingle(),
      supabase.from('saves').select('id').eq('user_id', user.id).eq('post_id', postId).maybeSingle(),
    ]);

    setIsLiked(!!likeData);
    setIsSaved(!!saveData);
  };

  const handleLike = async () => {
    if (!user) {
      toast.error('Please sign in to like posts');
      return;
    }

    const newLikedState = !isLiked;
    setIsLiked(newLikedState);
    setLikesCount(prev => newLikedState ? prev + 1 : prev - 1);

    if (newLikedState) {
      const { error } = await supabase.from('likes').insert({ user_id: user.id, post_id: postId });
      if (error) {
        setIsLiked(!newLikedState);
        setLikesCount(prev => prev - 1);
        toast.error('Failed to like post');
      } else if (post?.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post?.user_id,
          actor_id: user.id,
          type: 'like',
          post_id: postId,
        });
      }
    } else {
      const { error } = await supabase.from('likes').delete().eq('user_id', user.id).eq('post_id', postId);
      if (error) {
        setIsLiked(!newLikedState);
        setLikesCount(prev => prev + 1);
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
      const { error } = await supabase.from('saves').insert({ user_id: user.id, post_id: postId });
      if (error) {
        setIsSaved(!newSavedState);
        toast.error('Failed to save post');
      } else {
        toast.success('Post saved');
      }
    } else {
      const { error } = await supabase.from('saves').delete().eq('user_id', user.id).eq('post_id', postId);
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

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim() || submitting) return;

    setSubmitting(true);
    const { error } = await supabase.from('comments').insert({
      user_id: user.id,
      post_id: postId,
      content: commentText.trim(),
    });

    if (error) {
      toast.error('Failed to post comment');
    } else {
      setCommentText('');
      fetchComments();
      if (post?.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post?.user_id,
          actor_id: user.id,
          type: 'comment',
          post_id: postId,
        });
      }
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="aspect-square w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!post) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto p-4 text-center py-12">
          <h2 className="text-xl font-semibold">Post not found</h2>
          <Button onClick={() => navigate(-1)} variant="outline" className="mt-4">
            Go Back
          </Button>
        </div>
      </MainLayout>
    );
  }

  const captionIsLong = post.caption && post.caption.length > 100;

  const postTitle = `${post.profiles.username} on Openflip${post.caption ? `: ${post.caption.slice(0, 60)}` : ''}`;
  const postDesc = post.caption?.slice(0, 160) || `Post by @${post.profiles.username} on Openflip.`;

  return (
    <MainLayout>
      <Seo
        title={postTitle}
        description={postDesc}
        path={`/post/${post.id}`}
        type="article"
        image={post.media_type === 'image' ? post.media_url : undefined}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SocialMediaPosting',
          headline: postTitle,
          articleBody: post.caption || undefined,
          datePublished: post.created_at,
          image: post.media_type === 'image' ? post.media_url : undefined,
          author: {
            '@type': 'Person',
            name: post.profiles.full_name || post.profiles.username,
            url: `https://openflip.lovable.app/profile/${post.profiles.username}`,
          },
        }}
      />
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" aria-label="Go back" onClick={() => navigate(-1)}>
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold">Post</h1>
        </header>

        {/* Post Author */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Link to={`/profile/${post.profiles.username}`} className="flex items-center gap-3 group">
            <Avatar className="h-10 w-10 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
              <AvatarImage src={post.profiles.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {post.profiles.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-semibold group-hover:text-primary transition-colors">
                  {post.profiles.username}
                </span>
                {post.profiles.is_verified && (
                  <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                )}
              </div>
              {post.location && (
                <span className="text-xs text-muted-foreground">{post.location}</span>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {isOwnPost ? (
              <PostActions 
                postId={postId!} 
                onDeleted={() => navigate(-1)}
              />
            ) : (
              <>
                <Button
                  variant={isFollowing ? 'secondary' : 'gradient'}
                  size="sm"
                  onClick={handleFollow}
                  disabled={followLoading || followActionLoading}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowBlockReport(true)}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Media */}
        <div className="relative aspect-square bg-muted cursor-pointer" onDoubleClick={handleDoubleTap}>
          <ProtectedMedia
            src={post.media_url}
            type={post.media_type}
            alt={post.caption || 'Post media'}
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
                <Heart className="w-24 h-24 text-primary-foreground fill-primary drop-shadow-lg" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 space-y-2 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="icon" size="icon-sm" onClick={handleLike} className="hover:scale-110 transition-transform">
                <Heart className={cn("h-6 w-6 transition-colors", isLiked ? "fill-destructive text-destructive animate-heart-beat" : "")} />
              </Button>
              <Button variant="icon" size="icon-sm">
                <MessageCircle className="h-6 w-6" />
              </Button>
              <Button variant="icon" size="icon-sm" onClick={() => setShowShareSheet(true)}>
                <Send className="h-6 w-6" />
              </Button>
            </div>
            <Button variant="icon" size="icon-sm" onClick={handleSave} className="hover:scale-110 transition-transform">
              <Bookmark className={cn("h-6 w-6 transition-colors", isSaved ? "fill-foreground" : "")} />
            </Button>
          </div>

          {likesCount > 0 && (
            <p className="text-sm font-semibold">
              {likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}
            </p>
          )}

          {/* Caption */}
          {post.caption && (
            <div className="text-sm">
              <Link to={`/profile/${post.profiles.username}`} className="font-semibold hover:text-primary transition-colors mr-2">
                {post.profiles.username}
              </Link>
              <span className={cn(!expandedCaption && captionIsLong && 'line-clamp-2')}>
                {post.caption}
              </span>
              {captionIsLong && (
                <button
                  onClick={() => setExpandedCaption(!expandedCaption)}
                  className="text-muted-foreground hover:text-foreground ml-1 inline-flex items-center gap-1"
                >
                  {expandedCaption ? (
                    <>less <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>more <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground uppercase">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>

        {/* Comments Section */}
        <div className="divide-y divide-border">
          {comments.length > 0 ? (
            comments.map(comment => (
              <div key={comment.id} className="px-4 py-3">
                <div className="flex gap-3">
                  <Link to={`/profile/${comment.profiles.username}`}>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={comment.profiles.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {comment.profiles.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1">
                    <p className="text-sm">
                      <Link to={`/profile/${comment.profiles.username}`} className="font-semibold hover:text-primary transition-colors mr-2">
                        {comment.profiles.username}
                      </Link>
                      {comment.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </p>
                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-3 space-y-3 pl-4 border-l border-border">
                        {comment.replies.map(reply => (
                          <div key={reply.id} className="flex gap-3">
                            <Link to={`/profile/${reply.profiles.username}`}>
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={reply.profiles.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {reply.profiles.username.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </Link>
                            <div>
                              <p className="text-sm">
                                <Link to={`/profile/${reply.profiles.username}`} className="font-semibold hover:text-primary transition-colors mr-2">
                                  {reply.profiles.username}
                                </Link>
                                {reply.content}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center">
              <p className="text-muted-foreground">No comments yet</p>
              <p className="text-sm text-muted-foreground">Start the conversation.</p>
            </div>
          )}
        </div>

        {/* Comment Input */}
        {user && (
          <div className="sticky bottom-0 glass-strong border-t px-4 py-3">
            <form onSubmit={handleComment} className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <Input
                placeholder="Add a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="ghost" size="sm" disabled={!commentText.trim() || submitting}>
                Post
              </Button>
            </form>
          </div>
        )}

        {/* Share Sheet */}
        <ShareSheet
          open={showShareSheet}
          onOpenChange={setShowShareSheet}
          type="post"
          itemId={post.id}
        />

        {/* Block/Report Sheet */}
        {!isOwnPost && (
          <BlockReportSheet
            open={showBlockReport}
            onOpenChange={setShowBlockReport}
            targetUserId={post.profiles.id}
            targetUsername={post.profiles.username}
            context={{ postId: post.id }}
          />
        )}
      </div>
    </MainLayout>
  );
}
