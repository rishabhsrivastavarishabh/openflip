import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Send, Loader2, MessageCircle, Image } from 'lucide-react';
import { toast } from 'sonner';

interface Group {
  id: string;
  group_name: string;
  group_avatar_url: string | null;
  participant_count: number;
}

interface StoryReplyToGroupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyId: string;
  storyPreviewUrl: string;
  storyOwnerId: string;
}

export function StoryReplyToGroup({
  open,
  onOpenChange,
  storyId,
  storyPreviewUrl,
  storyOwnerId,
}: StoryReplyToGroupProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open && user) {
      fetchGroups();
    }
  }, [open, user]);

  const fetchGroups = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Get user's group conversations
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const conversationIds = participations?.map(p => p.conversation_id) || [];

      if (conversationIds.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Get group conversations
      const { data: conversations } = await (supabase as any)
        .from('conversations')
        .select('id, group_name, group_avatar_url')
        .eq('is_group', true)
        .in('id', conversationIds);

      if (!conversations || conversations.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      // Get participant counts
      const groupIds = conversations.map((c: any) => c.id);
      const { data: allParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .in('conversation_id', groupIds);

      const participantCounts = new Map<string, number>();
      allParticipants?.forEach((p: any) => {
        participantCounts.set(p.conversation_id, (participantCounts.get(p.conversation_id) || 0) + 1);
      });

      const groupsWithCounts = conversations.map((c: any) => ({
        ...c,
        participant_count: participantCounts.get(c.id) || 0,
      }));

      setGroups(groupsWithCounts);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShareToGroup = async (groupId: string) => {
    if (!user || !message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(groupId);
    try {
      // Send story reply message to group
      await supabase.from('messages').insert({
        conversation_id: groupId,
        sender_id: user.id,
        content: message.trim(),
        message_type: 'story_reply',
        story_id: storyId,
        story_reply_preview_url: storyPreviewUrl,
      });

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', groupId);

      // Get group participants for notifications
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', groupId)
        .neq('user_id', user.id);

      // Create notifications for group members
      if (participants && participants.length > 0) {
        const notifications = participants.map((p: any) => ({
          user_id: p.user_id,
          actor_id: user.id,
          type: 'story_reply',
        }));

        await supabase.from('notifications').insert(notifications);
      }

      toast.success('Shared to group!');
      onOpenChange(false);
      setMessage('');
    } catch (error) {
      console.error('Error sharing to group:', error);
      toast.error('Failed to share');
    } finally {
      setSending(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Share Story Reply to Group
          </SheetTitle>
        </SheetHeader>

        {/* Story Preview */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 mb-4">
          <div className="w-16 h-20 rounded-lg overflow-hidden bg-muted">
            <img src={storyPreviewUrl} alt="Story preview" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Replying to story</p>
            <Input
              placeholder="Add a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100%-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No group chats yet</p>
              <p className="text-sm text-muted-foreground">Create a group to share story replies</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <motion.button
                  key={group.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleShareToGroup(group.id)}
                  disabled={sending !== null || !message.trim()}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors disabled:opacity-50"
                >
                  <Avatar className="w-12 h-12">
                    {group.group_avatar_url ? (
                      <AvatarImage src={group.group_avatar_url} />
                    ) : (
                      <AvatarFallback className="bg-primary/10">
                        <Users className="w-5 h-5 text-primary" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{group.group_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.participant_count} members
                    </p>
                  </div>
                  {sending === group.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <Send className="w-5 h-5 text-muted-foreground" />
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
