import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, Music2, MoreHorizontal, Volume2, VolumeX, Play, Eye, UserPlus } from 'lucide-react';
import { Reel } from '@/types/database';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ShareSheet } from '@/components/share/ShareSheet';
import { BlockReportSheet } from '@/components/moderation/BlockReportSheet';
import { ReelProgress } from './ReelProgress';
import { ReelComments } from './ReelComments';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';

interface ReelCardProps {
  reel: Reel;
  isActive: boolean;
  onLike: () => void;
  globalMuted?: boolean;
  onMuteToggle?: () => void;
}

export function ReelCard({ reel, isActive, onLike, globalMuted = false, onMuteToggle }: ReelCardProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(globalMuted);
  const [isLiked, setIsLiked] = useState(reel.isLiked || false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(reel.likeCount || 0);
  const [showHeart, setShowHeart] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showBlockReport, setShowBlockReport] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Check follow status
  useEffect(() => {
    if (user && reel.user_id !== user.id) {
      checkFollowStatus();
    }
  }, [user, reel.user_id]);

  const checkFollowStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', reel.user_id)
      .maybeSingle();
    setIsFollowing(!!data);
  };

  const handleFollow = async () => {
    if (!user || followLoading) return;
    setFollowLoading(true);

    if (isFollowing) {
      await supabase.from('follows').delete()
        .eq('follower_id', user.id)
        .eq('following_id', reel.user_id);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: reel.user_id,
      });
      await supabase.from('notifications').insert({
        user_id: reel.user_id,
        actor_id: user.id,
        type: 'follow',
      });
      setIsFollowing(true);
    }
    setFollowLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaved(!isSaved);
    // Note: Would need a reel_saves table for full implementation
  };

  // Sync with global mute state
  useEffect(() => {
    setIsMuted(globalMuted);
  }, [globalMuted]);

  // Play/pause based on active state - audio ON by default when active
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
        // Unmute by default when reel becomes active (unless globally muted)
        if (!globalMuted) {
          setIsMuted(false);
        }
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isActive, globalMuted]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
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

  const handleLike = async () => {
    if (!user) return;

    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikeCount((prev) => (newIsLiked ? prev + 1 : prev - 1));

    try {
      if (newIsLiked) {
        await supabase.from('reel_likes').insert({
          reel_id: reel.id,
          user_id: user.id,
        });
      } else {
        await supabase.from('reel_likes').delete().match({
          reel_id: reel.id,
          user_id: user.id,
        });
      }
      onLike();
    } catch (error) {
      // Revert on error
      setIsLiked(!newIsLiked);
      setLikeCount((prev) => (!newIsLiked ? prev + 1 : prev - 1));
    }
  };

  return (
    <div 
      className="relative w-full h-full bg-black snap-start snap-always"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Video - Protected with no download */}
      <div 
        className="w-full h-full select-none"
        style={{ WebkitTouchCallout: 'none' }}
      >
        <video
          ref={videoRef}
          src={reel.video_url}
          className="w-full h-full object-contain pointer-events-none"
          style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
          loop
          muted={isMuted}
          playsInline
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
        />
        {/* Overlay for click handling */}
        <div 
          className="absolute inset-0"
          onClick={togglePlay}
          onDoubleClick={handleDoubleTap}
        />
      </div>

      {/* Play indicator */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-20 h-20 bg-black/50 rounded-full flex items-center justify-center">
              <Play className="w-10 h-10 text-white ml-1" fill="white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double tap heart */}
      <AnimatePresence>
        {showHeart && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <Heart className="w-24 h-24 text-white" fill="white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right actions */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-4">
        {/* Profile with follow */}
        <div className="relative">
          <Link to={`/profile/${reel.user_id}`}>
            <Avatar className="w-12 h-12 ring-2 ring-white shadow-lg">
              <AvatarImage src={reel.profiles?.avatar_url || undefined} />
              <AvatarFallback>{reel.profiles?.username?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </Link>
          {user && user.id !== reel.user_id && !isFollowing && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-black hover:bg-primary/90 transition-colors"
            >
              <UserPlus className="w-3 h-3 text-primary-foreground" />
            </button>
          )}
        </div>

        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-1 active:scale-90 transition-transform">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            isLiked ? "bg-destructive/20" : "bg-white/10"
          )}>
            <Heart
              className={cn('w-6 h-6 transition-all', isLiked ? 'text-destructive fill-destructive scale-110' : 'text-white')}
            />
          </div>
          <span className="text-white text-xs font-medium">{likeCount}</span>
        </button>

        {/* Comment */}
        <button 
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          onClick={() => setShowComments(true)}
        >
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs font-medium">{reel.commentCount || 0}</span>
        </button>

        {/* Save */}
        <button 
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          onClick={handleSave}
        >
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            isSaved ? "bg-primary/20" : "bg-white/10"
          )}>
            <Bookmark className={cn('w-6 h-6', isSaved ? 'text-primary fill-primary' : 'text-white')} />
          </div>
          <span className="text-white text-xs font-medium">Save</span>
        </button>

        {/* Share */}
        <button 
          className="flex flex-col items-center gap-1 active:scale-90 transition-transform"
          onClick={() => setShowShareSheet(true)}
        >
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs font-medium">Share</span>
        </button>

        {/* More */}
        <button 
          onClick={() => setShowBlockReport(true)}
          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
        >
          <MoreHorizontal className="w-6 h-6 text-white" />
        </button>

        {/* Audio disc */}
        {reel.audio_name && (
          <motion.div 
            animate={{ rotate: isPlaying ? 360 : 0 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg"
          >
            <div className="w-3 h-3 rounded-full bg-black" />
          </motion.div>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute left-4 right-20 bottom-8 space-y-3">
        {/* Username + Follow */}
        <div className="flex items-center gap-3">
          <Link to={`/profile/${reel.user_id}`} className="flex items-center gap-2">
            <span className="text-white font-bold text-base">{reel.profiles?.username}</span>
            {reel.profiles?.is_verified && <VerifiedBadge size="sm" />}
          </Link>
          {user && user.id !== reel.user_id && !isFollowing && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-white text-xs font-medium hover:bg-white/20 transition-colors border border-white/30"
            >
              Follow
            </button>
          )}
        </div>

        {/* Caption */}
        {reel.caption && (
          <p className="text-white text-sm line-clamp-2 drop-shadow-lg">{reel.caption}</p>
        )}

        {/* View count */}
        {reel.view_count !== undefined && reel.view_count > 0 && (
          <div className="flex items-center gap-1.5 text-white/80">
            <Eye className="w-4 h-4" />
            <span className="text-xs">{reel.view_count.toLocaleString()} views</span>
          </div>
        )}

        {/* Audio */}
        {reel.audio_name && (
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 w-fit">
            <Music2 className="w-3.5 h-3.5 text-white animate-bounce" />
            <div className="overflow-hidden max-w-[200px]">
              <span className="text-white text-xs whitespace-nowrap animate-marquee">
                {reel.audio_name} {reel.audio_artist && `• ${reel.audio_artist}`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mute toggle - top left */}
      <button
        onClick={() => {
          const newMuted = !isMuted;
          setIsMuted(newMuted);
          onMuteToggle?.();
        }}
        className="absolute top-16 md:top-20 right-4 w-10 h-10 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/60 transition-colors"
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Progress bar */}
      <ReelProgress duration={30000} isPlaying={isPlaying} />

      {/* Comments Sheet */}
      <ReelComments
        reelId={reel.id}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
      />

      {/* Share Sheet */}
      <ShareSheet
        open={showShareSheet}
        onOpenChange={setShowShareSheet}
        type="reel"
        itemId={reel.id}
      />

      {/* Block/Report Sheet */}
      {reel.profiles && (
        <BlockReportSheet
          open={showBlockReport}
          onOpenChange={setShowBlockReport}
          targetUserId={reel.user_id}
          targetUsername={reel.profiles.username}
          context={{ reelId: reel.id }}
        />
      )}
    </div>
  );
}
