import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MessageButtonProps {
  targetUserId: string;
  variant?: 'default' | 'secondary' | 'ghost' | 'outline' | 'icon';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';
  showLabel?: boolean;
  className?: string;
}

export function MessageButton({ 
  targetUserId, 
  variant = 'secondary', 
  size = 'sm',
  showLabel = true,
  className 
}: MessageButtonProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleMessage = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (targetUserId === user.id) {
      toast.error("You can't message yourself");
      return;
    }

    setLoading(true);

    try {
      // Check for existing conversation
      const { data: myConversations } = await (supabase as any)
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const myConvoIds = myConversations?.map((c: any) => c.conversation_id) || [];

      if (myConvoIds.length > 0) {
        // Check if there's an existing 1-on-1 conversation
        const { data: theirParticipation } = await (supabase as any)
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', targetUserId)
          .in('conversation_id', myConvoIds);

        if (theirParticipation && theirParticipation.length > 0) {
          // Find 1-on-1 conversation (not group)
          for (const participation of theirParticipation) {
            const { data: convo } = await (supabase as any)
              .from('conversations')
              .select('id, is_group')
              .eq('id', participation.conversation_id)
              .single();

            if (convo && !convo.is_group) {
              navigate(`/messages/${convo.id}`);
              return;
            }
          }
        }
      }

      // Create new conversation
      const { data: newConvo, error: convoError } = await (supabase as any)
        .from('conversations')
        .insert({ is_group: false })
        .select()
        .single();

      if (convoError) throw convoError;

      // Add participants
      await (supabase as any).from('conversation_participants').insert([
        { conversation_id: newConvo.id, user_id: user.id },
        { conversation_id: newConvo.id, user_id: targetUserId },
      ]);

      navigate(`/messages/${newConvo.id}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };

  if (targetUserId === user?.id) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleMessage}
      disabled={loading}
      className={cn(className)}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <MessageCircle className="h-4 w-4" />
          {showLabel && <span className="ml-1">Message</span>}
        </>
      )}
    </Button>
  );
}
