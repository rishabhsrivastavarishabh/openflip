import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, MoreHorizontal, Trash2, Edit2, Pause, Play } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Story {
  id: string;
  media_url: string;
  media_type: string;
}

interface Highlight {
  id: string;
  title: string;
  cover_url: string | null;
  stories: Story[];
}

interface StoryHighlightViewerProps {
  highlight: Highlight;
  isOpen: boolean;
  onClose: () => void;
  isOwnProfile: boolean;
  onEdit?: (highlightId: string) => void;
  onDeleted?: () => void;
}

export function StoryHighlightViewer({
  highlight,
  isOpen,
  onClose,
  isOwnProfile,
  onEdit,
  onDeleted,
}: StoryHighlightViewerProps) {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [profile, setProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);

  const STORY_DURATION = 5000; // 5 seconds per story

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setProgress(0);
      fetchProfile();
    }
  }, [isOpen, highlight.id]);

  useEffect(() => {
    if (!isOpen || isPaused || highlight.stories.length === 0) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Move to next story
          if (currentIndex < highlight.stories.length - 1) {
            setCurrentIndex(currentIndex + 1);
            return 0;
          } else {
            // End of highlight
            onClose();
            return 0;
          }
        }
        return prev + (100 / (STORY_DURATION / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, currentIndex, highlight.stories.length, onClose]);

  const fetchProfile = async () => {
    // Get the user_id from the highlight
    const { data: highlightData } = await (supabase as any)
      .from('story_highlights')
      .select('user_id')
      .eq('id', highlight.id)
      .single();

    if (highlightData) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', highlightData.user_id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }
    }
  };

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < highlight.stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, highlight.stories.length, onClose]);

  const handleDelete = async () => {
    if (!user) return;

    try {
      // Delete highlight stories first
      await (supabase as any)
        .from('highlight_stories')
        .delete()
        .eq('highlight_id', highlight.id);

      // Delete the highlight
      await (supabase as any)
        .from('story_highlights')
        .delete()
        .eq('id', highlight.id);

      toast.success('Highlight deleted');
      onDeleted?.();
      onClose();
    } catch (error) {
      console.error('Error deleting highlight:', error);
      toast.error('Failed to delete highlight');
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  if (!isOpen) return null;

  const hasStories = highlight.stories.length > 0;
  const currentStory = hasStories ? highlight.stories[currentIndex] : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex items-center justify-center"
        onClick={togglePause}
      >
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 z-50 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Progress bars */}
        <div className="absolute top-2 left-4 right-4 flex gap-1 z-40">
          {highlight.stories.map((_, index) => (
            <div
              key={index}
              className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width: index < currentIndex ? '100%' : index === currentIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-4 right-4 flex items-center justify-between z-40">
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 ring-2 ring-white/50">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs bg-primary/20 text-white">
                {profile?.username?.charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="text-white">
              <p className="text-sm font-semibold">{highlight.title}</p>
              <p className="text-xs text-white/70">@{profile?.username}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePause();
              }}
              className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>

            {isOwnProfile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background border-border">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(highlight.id);
                      onClose();
                    }}
                    className="cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Highlight
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Highlight
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Navigation buttons */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 z-40 p-2 text-white hover:bg-white/10 rounded-full transition-colors",
            currentIndex === 0 && "opacity-50 pointer-events-none"
          )}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronRight className="w-8 h-8" />
        </button>

        {/* Story content */}
        <div className="w-full max-w-md h-full max-h-[80vh] relative">
          {!hasStories ? (
            <div className="w-full h-full flex items-center justify-center text-white/70 text-center px-6">
              <div>
                <p className="text-lg font-semibold mb-2">No stories in this highlight yet</p>
                <p className="text-sm">Add stories from the editor to see them here.</p>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStory!.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full flex items-center justify-center"
              >
                {currentStory!.media_type === 'video' ? (
                  <video src={currentStory!.media_url} className="max-w-full max-h-full object-contain rounded-lg" autoPlay muted loop />
                ) : (
                  <img src={currentStory!.media_url} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Pause indicator */}
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-black/50 rounded-full p-4">
              <Pause className="w-12 h-12 text-white" />
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
