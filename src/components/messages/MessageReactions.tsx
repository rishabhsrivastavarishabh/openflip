import { useState, useEffect } from 'react';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Smile, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
}

interface MessageReactionsProps {
  messageId: string;
  isMine: boolean;
  onReactionAdded?: () => void;
}

const EMOJI_OPTIONS = ['❤️', '👍', '👎', '😂', '😮', '😢', '🔥', '🎉'];

export function MessageReactions({ messageId, isMine, onReactionAdded }: MessageReactionsProps) {
  const { user } = useAuth();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchReactions();
    
    const channel = supabase
      .channel(`reactions-${messageId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
        filter: `message_id=eq.${messageId}`
      }, () => fetchReactions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [messageId]);

  const fetchReactions = async () => {
    const { data } = await (supabase as any)
      .from('message_reactions')
      .select('id, emoji, user_id')
      .eq('message_id', messageId);
    
    if (data) setReactions(data);
  };

  const toggleReaction = async (emoji: string) => {
    if (!user) return;

    const existingReaction = reactions.find(r => r.emoji === emoji && r.user_id === user.id);

    if (existingReaction) {
      await (supabase as any)
        .from('message_reactions')
        .delete()
        .eq('id', existingReaction.id);
    } else {
      await (supabase as any)
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji
        });
    }

    setOpen(false);
    onReactionAdded?.();
  };

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    acc[r.emoji] = acc[r.emoji] || [];
    acc[r.emoji].push(r);
    return acc;
  }, {} as Record<string, Reaction[]>);

  return (
    <div className={cn("flex items-center gap-1", isMine ? "flex-row-reverse" : "")}>
      {/* Display reactions */}
      {Object.entries(groupedReactions).map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => toggleReaction(emoji)}
          className={cn(
            "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs",
            "bg-muted hover:bg-muted/80 transition-colors",
            users.some(u => u.user_id === user?.id) && "ring-1 ring-primary"
          )}
        >
          <span>{emoji}</span>
          {users.length > 1 && <span className="text-muted-foreground">{users.length}</span>}
        </button>
      ))}

      {/* Add reaction button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Smile className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align={isMine ? "end" : "start"}>
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className={cn(
                  "p-1.5 text-lg hover:bg-muted rounded transition-colors",
                  reactions.some(r => r.emoji === emoji && r.user_id === user?.id) && "bg-primary/10"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
