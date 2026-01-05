import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, Image as ImageIcon, MoreVertical, Phone, Video, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Profile, Message } from '@/types/database';
import { BlockReportSheet } from '@/components/moderation/BlockReportSheet';

interface ChatMessage extends Message {
  isMine: boolean;
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [participant, setParticipant] = useState<Profile | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showBlockReport, setShowBlockReport] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && conversationId) {
      fetchMessages();
      fetchParticipant();
      const unsubscribe = subscribeToMessages();
      return () => {
        unsubscribe();
      };
    }
  }, [user, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchParticipant = async () => {
    if (!conversationId || !user) return;

    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id, typing_at')
      .eq('conversation_id', conversationId)
      .neq('user_id', user.id);

    if (participants && participants.length > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', participants[0].user_id)
        .single();

      if (profile) {
        setParticipant(profile as Profile);
      }

      // Check typing status
      if (participants[0].typing_at) {
        const isRecentlyTyping = new Date().getTime() - new Date(participants[0].typing_at).getTime() < 5000;
        setIsTyping(isRecentlyTyping);
      }
    }
  };

  const fetchMessages = async () => {
    if (!conversationId || !user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const chatMessages: ChatMessage[] = (data || []).map(msg => ({
        ...msg,
        isMine: msg.sender_id === user.id,
      }));

      setMessages(chatMessages);

      // Mark messages as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id);

      // Update last_read_at
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, {
            ...newMsg,
            isMine: newMsg.sender_id === user?.id,
          }]);

          // Mark as read if not mine
          if (newMsg.sender_id !== user?.id) {
            supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', newMsg.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.user_id !== user?.id && updated.typing_at) {
            const isRecentlyTyping = new Date().getTime() - new Date(updated.typing_at).getTime() < 5000;
            setIsTyping(isRecentlyTyping);
            
            // Clear typing after 5 seconds
            if (isRecentlyTyping) {
              setTimeout(() => setIsTyping(false), 5000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleTyping = async () => {
    if (!user || !conversationId) return;

    await supabase
      .from('conversation_participants')
      .update({ typing_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    // Clear typing after 5 seconds
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(async () => {
      await supabase
        .from('conversation_participants')
        .update({ typing_at: null })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    }, 5000);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !conversationId) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: messageContent,
      });

      if (error) throw error;

      // Clear typing status
      await supabase
        .from('conversation_participants')
        .update({ typing_at: null })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p>Please sign in</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-3 flex items-center gap-3">
        <button onClick={() => navigate('/messages')}>
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        {participant ? (
          <Link to={`/profile/${participant.id}`} className="flex items-center gap-3 flex-1">
            <Avatar className="w-10 h-10">
              <AvatarImage src={participant.avatar_url || undefined} />
              <AvatarFallback>{participant.username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{participant.username}</p>
              {isTyping && (
                <p className="text-xs text-primary animate-pulse">typing...</p>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 flex-1">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="w-24 h-4" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Phone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowBlockReport(true)}>
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Block/Report Sheet */}
      {participant && (
        <BlockReportSheet
          open={showBlockReport}
          onOpenChange={setShowBlockReport}
          targetUserId={participant.id}
          targetUsername={participant.username}
          onBlocked={() => navigate('/messages')}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                <Skeleton className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-40" : "w-32")} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p>No messages yet</p>
            <p className="text-sm">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const showAvatar = !message.isMine && (
              index === 0 || messages[index - 1]?.sender_id !== message.sender_id
            );

            return (
              <div
                key={message.id}
                className={cn(
                  "flex items-end gap-2",
                  message.isMine ? "justify-end" : "justify-start"
                )}
              >
                {!message.isMine && (
                  <div className="w-8">
                    {showAvatar && participant && (
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={participant.avatar_url || undefined} />
                        <AvatarFallback>{participant.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}
                
                <div
                  className={cn(
                    "max-w-[70%] px-4 py-2 rounded-2xl",
                    message.isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                </div>

                {message.isMine && (
                  <div className="w-4 flex items-center justify-center">
                    {message.is_read ? (
                      <CheckCheck className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ImageIcon className="w-5 h-5" />
          </Button>
          <Input
            ref={inputRef}
            placeholder="Message..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
