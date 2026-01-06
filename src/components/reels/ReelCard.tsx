import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, Bookmark, Music2, MoreHorizontal, Volume2, VolumeX, Play } from 'lucide-react';
import { Reel } from '@/types/database';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ShareSheet } from '@/components/share/ShareSheet';
import { BlockReportSheet } from '@/components/moderation/BlockReportSheet';
import { ProtectedMedia } from '@/components/media/ProtectedMedia';

interface ReelCardProps {
  reel: Reel;
  isActive: boolean;
  onLike: () => void;
}

export function ReelCard({ reel, isActive, onLike }: ReelCardProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLiked, setIsLiked] = useState(reel.isLiked || false);
  const [likeCount, setLikeCount] = useState(reel.likeCount || 0);
  const [showHeart, setShowHeart] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showBlockReport, setShowBlockReport] = useState(false);

  // Play/pause based on active state
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isActive]);

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
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        {/* Profile */}
        <Link to={`/profile/${reel.user_id}`} className="relative">
          <Avatar className="w-11 h-11 ring-2 ring-white">
            <AvatarImage src={reel.profiles?.avatar_url || undefined} />
            <AvatarFallback>{reel.profiles?.username?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-black">
            <span className="text-primary-foreground text-xs">+</span>
          </div>
        </Link>

        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <Heart
            className={cn('w-7 h-7', isLiked ? 'text-destructive fill-destructive' : 'text-white')}
          />
          <span className="text-white text-xs font-medium">{likeCount}</span>
        </button>

        {/* Comment */}
        <button className="flex flex-col items-center gap-1">
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="text-white text-xs font-medium">{reel.commentCount || 0}</span>
        </button>

        {/* Share */}
        <button 
          className="flex flex-col items-center gap-1"
          onClick={() => setShowShareSheet(true)}
        >
          <Share2 className="w-7 h-7 text-white" />
          <span className="text-white text-xs font-medium">Share</span>
        </button>

        {/* More */}
        <button onClick={() => setShowBlockReport(true)}>
          <MoreHorizontal className="w-7 h-7 text-white" />
        </button>

        {/* Audio disc */}
        {reel.audio_name && (
          <div className="w-11 h-11 rounded-full bg-gradient-to-r from-muted to-muted/80 flex items-center justify-center animate-spin-slow">
            <div className="w-4 h-4 rounded-full bg-black" />
          </div>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute left-3 right-16 bottom-6 space-y-3">
        {/* Username */}
        <Link to={`/profile/${reel.user_id}`} className="flex items-center gap-2">
          <span className="text-white font-semibold">{reel.profiles?.username}</span>
        </Link>

        {/* Caption */}
        {reel.caption && (
          <p className="text-white text-sm line-clamp-2">{reel.caption}</p>
        )}

        {/* Audio */}
        {reel.audio_name && (
          <div className="flex items-center gap-2">
            <Music2 className="w-4 h-4 text-white" />
            <div className="flex items-center gap-1 overflow-hidden">
              <span className="text-white text-xs truncate">
                {reel.audio_name} {reel.audio_artist && `• ${reel.audio_artist}`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mute toggle */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="absolute top-4 right-3 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center"
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>

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
