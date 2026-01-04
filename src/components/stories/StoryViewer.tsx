import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Eye, Send, Pause, Play } from 'lucide-react';
import { StoryGroup, StoryView } from '@/types/database';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface StoryViewerProps {
  storyGroups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

export function StoryViewer({ storyGroups, initialGroupIndex, onClose }: StoryViewerProps) {
  const { user } = useAuth();
  const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewers, setViewers] = useState<StoryView[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [replyText, setReplyText] = useState('');
  
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentGroup = storyGroups[currentGroupIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];
  const isOwnStory = currentStory?.user_id === user?.id;
  const storyDuration = currentStory?.media_type === 'video' ? 30000 : 5000; // 30s for video, 5s for image

  // Record view
  useEffect(() => {
    if (currentStory && user && !isOwnStory) {
      supabase
        .from('story_views')
        .upsert({
          story_id: currentStory.id,
          viewer_id: user.id,
        }, { onConflict: 'story_id,viewer_id' })
        .then(() => {});
    }
  }, [currentStory?.id, user, isOwnStory]);

  // Fetch viewers for own stories
  useEffect(() => {
    if (isOwnStory && currentStory) {
      fetchViewers();
    }
  }, [currentStory?.id, isOwnStory]);

  const fetchViewers = async () => {
    if (!currentStory) return;
    
    const { data } = await supabase
      .from('story_views')
      .select(`
        *,
        profiles:viewer_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('story_id', currentStory.id)
      .order('viewed_at', { ascending: false });

    if (data) {
      setViewers(data as any);
    }
  };

  // Progress timer
  useEffect(() => {
    if (isPaused) return;

    setProgress(0);
    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          goToNextStory();
          return 0;
        }
        return prev + (100 / (storyDuration / 100));
      });
    }, 100);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentStoryIndex, currentGroupIndex, isPaused, storyDuration]);

  const goToNextStory = useCallback(() => {
    if (currentStoryIndex < currentGroup.stories.length - 1) {
      setCurrentStoryIndex((prev) => prev + 1);
    } else if (currentGroupIndex < storyGroups.length - 1) {
      setCurrentGroupIndex((prev) => prev + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  }, [currentStoryIndex, currentGroupIndex, currentGroup?.stories.length, storyGroups.length, onClose]);

  const goToPrevStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex((prev) => prev - 1);
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex((prev) => prev - 1);
      setCurrentStoryIndex(storyGroups[currentGroupIndex - 1].stories.length - 1);
    }
  }, [currentStoryIndex, currentGroupIndex, storyGroups]);

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width / 3) {
      goToPrevStory();
    } else if (x > (width * 2) / 3) {
      goToNextStory();
    } else {
      setIsPaused(!isPaused);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !currentStory || !user) return;
    // TODO: Implement DM reply to story
    setReplyText('');
  };

  if (!currentGroup || !currentStory) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
      >
        {/* Navigation arrows - desktop */}
        <button
          onClick={goToPrevStory}
          className="hidden md:flex absolute left-4 z-50 w-10 h-10 items-center justify-center bg-background/20 rounded-full hover:bg-background/30 transition-colors"
          disabled={currentGroupIndex === 0 && currentStoryIndex === 0}
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>

        <button
          onClick={goToNextStory}
          className="hidden md:flex absolute right-4 z-50 w-10 h-10 items-center justify-center bg-background/20 rounded-full hover:bg-background/30 transition-colors"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>

        {/* Story container */}
        <div
          className="relative w-full max-w-[420px] h-full max-h-[90vh] md:max-h-[800px] md:rounded-2xl overflow-hidden bg-black"
          onClick={handleTap}
        >
          {/* Progress bars */}
          <div className="absolute top-2 left-2 right-2 z-20 flex gap-1">
            {currentGroup.stories.map((_, index) => (
              <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-100"
                  style={{
                    width: index < currentStoryIndex ? '100%' : index === currentStoryIndex ? `${progress}%` : '0%'
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 left-2 right-2 z-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 ring-2 ring-white/20">
                <AvatarImage src={currentGroup.avatar_url || undefined} />
                <AvatarFallback>{currentGroup.username.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-white font-medium text-sm">{currentGroup.username}</p>
                <p className="text-white/60 text-xs">
                  {formatDistanceToNow(new Date(currentStory.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused(!isPaused);
                }}
                className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white"
              >
                {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Story media */}
          {currentStory.media_type === 'video' ? (
            <video
              ref={videoRef}
              src={currentStory.media_url}
              className="w-full h-full object-contain"
              autoPlay
              muted
              playsInline
              onPause={() => setIsPaused(true)}
              onPlay={() => setIsPaused(false)}
            />
          ) : (
            <img
              src={currentStory.media_url}
              alt=""
              className="w-full h-full object-contain"
            />
          )}

          {/* Footer */}
          <div className="absolute bottom-4 left-2 right-2 z-20">
            {isOwnStory ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowViewers(true);
                }}
                className="flex items-center gap-2 text-white/80 hover:text-white"
              >
                <Eye className="w-5 h-5" />
                <span className="text-sm">{viewers.length} viewers</span>
              </button>
            ) : (
              <div
                className="flex gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  placeholder="Reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSendReply}
                  disabled={!replyText.trim()}
                  className="text-white hover:bg-white/10"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Viewers panel */}
        {showViewers && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed bottom-0 left-0 right-0 max-w-[420px] mx-auto bg-card rounded-t-2xl p-4 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-card-foreground">Viewers</h3>
              <button onClick={() => setShowViewers(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-3">
              {viewers.map((view: any) => (
                <div key={view.id} className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={view.profiles?.avatar_url || undefined} />
                    <AvatarFallback>{view.profiles?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-card-foreground">{view.profiles?.username}</span>
                </div>
              ))}
              {viewers.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No viewers yet</p>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
