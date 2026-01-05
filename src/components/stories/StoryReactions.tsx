import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];

interface StoryReactionsProps {
  storyId: string;
  storyOwnerId: string;
  onReact?: (emoji: string) => void;
}

export function StoryReactions({ storyId, storyOwnerId, onReact }: StoryReactionsProps) {
  const { user } = useAuth();
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleReaction = async (emoji: string) => {
    if (!user || isAnimating) return;

    setIsAnimating(true);
    setSelectedEmoji(emoji);

    try {
      // Upsert reaction
      await (supabase as any)
        .from('story_reactions')
        .upsert({
          story_id: storyId,
          user_id: user.id,
          emoji,
        }, { onConflict: 'story_id,user_id' });

      // Create notification for story owner
      if (storyOwnerId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: storyOwnerId,
          actor_id: user.id,
          type: 'story_reaction',
          post_id: null,
        });
      }

      onReact?.(emoji);
    } catch (error) {
      console.error('Error reacting to story:', error);
    }

    setTimeout(() => {
      setSelectedEmoji(null);
      setIsAnimating(false);
    }, 1000);
  };

  return (
    <div className="flex items-center gap-2">
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className={cn(
            "w-10 h-10 rounded-full bg-white/10 flex items-center justify-center",
            "hover:bg-white/20 transition-colors hover:scale-110 active:scale-95",
            "text-xl"
          )}
        >
          {emoji}
        </button>
      ))}

      {/* Floating reaction animation */}
      <AnimatePresence>
        {selectedEmoji && (
          <motion.div
            initial={{ scale: 0, y: 0, opacity: 0 }}
            animate={{ scale: 2, y: -100, opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            className="fixed left-1/2 bottom-32 text-4xl pointer-events-none z-50"
          >
            {selectedEmoji}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
