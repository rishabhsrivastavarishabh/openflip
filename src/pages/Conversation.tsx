import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, MoreVertical, Phone, Video, Check, CheckCheck, Users, Lock, ShieldCheck, MoreHorizontal, Pencil, Trash2, X as XIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CallLogItem, CallLogEntry } from '@/components/messages/CallLogItem';
import { cn } from '@/lib/utils';
import { Profile, Message } from '@/types/database';
import { BlockReportSheet } from '@/components/moderation/BlockReportSheet';
import { OnlineIndicator } from '@/components/messages/OnlineIndicator';
import { VoiceRecordButton } from '@/components/messages/VoiceRecordButton';
import { VoiceMessage } from '@/components/messages/VoiceMessage';
import { SharedPostPreview } from '@/components/messages/SharedPostPreview';
import { ChatMediaInput } from '@/components/messages/ChatMediaInput';
import { ViewOnceMedia } from '@/components/messages/ViewOnceMedia';
import { MediaMessage } from '@/components/messages/MediaMessage';
import { DisappearingMessagesIndicator } from '@/components/messages/DisappearingMessagesIndicator';
import { GroupChatSettings } from '@/components/messages/GroupChatSettings';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { ProfileViewDialog } from '@/components/messages/ProfileViewDialog';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSendEncryptedMessage } from '@/hooks/useSendEncryptedMessage';
import { useDecryptMessage } from '@/hooks/useDecryptMessage';
import { useDeviceKeys } from '@/hooks/useDeviceKeys';
import { toast } from 'sonner';
import { useStartCall } from '@/hooks/useStartCall';
import { setActiveConversation } from '@/hooks/useActiveConversation';

interface ChatMessage extends Message {
  isMine: boolean;
  message_type?: string;
  media_url?: string;
  media_type?: string;
  voice_duration?: number;
  shared_post_id?: string;
  shared_reel_id?: string;
  shared_profile_id?: string;
  is_view_once?: boolean;
  viewed_at?: string;
  status?: string;
  delivered_at?: string;
  read_at?: string;
  reply_to_id?: string;
  file_name?: string;
  file_size?: number;
}

interface ConversationData {
  id: string;
  is_group: boolean;
  group_name: string | null;
  group_avatar_url: string | null;
  disappearing_messages_timer: number | null;
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [callLogs, setCallLogs] = useState<CallLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [participant, setParticipant] = useState<(Profile & { is_verified?: boolean }) | null>(null);
  const [participants, setParticipants] = useState<(Profile & { is_verified?: boolean })[]>([]);
  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showBlockReport, setShowBlockReport] = useState(false);
  const [showProfileView, setShowProfileView] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [decryptedContents, setDecryptedContents] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { fetchOnlineStatus, isUserOnline, getLastSeenText } = useOnlineStatus();
  const { sendEncrypted, isReady: encryptionReady } = useSendEncryptedMessage();
  const { decrypt } = useDecryptMessage();
  const { getRecipientPublicKey } = useDeviceKeys();
  const { startCall, starting: startingCall } = useStartCall();

  // Mark this chat as the active conversation so global push logic can suppress
  // duplicate notifications while the user is looking at it.
  useEffect(() => {
    setActiveConversation(conversationId ?? null);
    return () => setActiveConversation(null);
  }, [conversationId]);


  // Device public key cache for decryption
  const senderKeyCache = useRef<Record<string, string>>({});

  // Validate conversationId is a valid UUID
  const isValidUUID = (id: string | undefined): boolean => {
    if (!id) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  };

  useEffect(() => {
    if (!isValidUUID(conversationId)) {
      navigate('/messages');
      return;
    }
    if (user && conversationId) {
      fetchConversation();
      fetchMessages();
      fetchParticipant();
      fetchCallLogs();
      const unsubscribe = subscribeToMessages();
      const unsubscribeCalls = subscribeToCalls();
      return () => { unsubscribe(); unsubscribeCalls(); };
    }
  }, [user, conversationId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, callLogs]);

  const fetchConversation = async () => {
    if (!conversationId) return;
    
    const { data } = await (supabase as any)
      .from('conversations')
      .select('id, is_group, group_name, group_avatar_url, disappearing_messages_timer')
      .eq('id', conversationId)
      .single();
    
    if (data) {
      setConversation(data);
    }
  };

  const fetchParticipant = async () => {
    if (!conversationId || !user) return;
    const { data: participantsData } = await supabase
      .from('conversation_participants')
      .select('user_id, typing_at, is_admin')
      .eq('conversation_id', conversationId);

    if (participantsData) {
      // Check if current user is admin
      const currentUserParticipant = participantsData.find(p => p.user_id === user.id);
      setIsAdmin(currentUserParticipant?.is_admin || false);

      const otherParticipants = participantsData.filter(p => p.user_id !== user.id);
      
      if (otherParticipants.length > 0) {
        const userIds = otherParticipants.map(p => p.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        
        if (profiles && profiles.length > 0) {
          setParticipants(profiles as (Profile & { is_verified?: boolean })[]);
          setParticipant(profiles[0] as (Profile & { is_verified?: boolean }));
          fetchOnlineStatus(profiles.map(p => p.id));
        }

        // Check typing status
        const typingParticipant = otherParticipants.find(p => p.typing_at);
        if (typingParticipant?.typing_at) {
          setIsTyping(new Date().getTime() - new Date(typingParticipant.typing_at).getTime() < 5000);
        }
      }
    }
  };

  // Decrypt encrypted messages after fetching
  const decryptMessages = useCallback(async (msgs: ChatMessage[]) => {
    const newDecrypted: Record<string, string> = {};
    
    for (const msg of msgs) {
      if ((msg as any).is_encrypted && (msg as any).ciphertext) {
        const senderId = msg.sender_id;
        // Get sender's device public key (cached)
        if (!senderKeyCache.current[senderId]) {
          const pk = await getRecipientPublicKey(senderId);
          if (pk) senderKeyCache.current[senderId] = pk;
        }
        
        const senderPk = senderKeyCache.current[senderId] || null;
        const plaintext = await decrypt(
          msg.id,
          (msg as any).ciphertext,
          (msg as any).nonce,
          (msg as any).aad,
          senderPk,
          true
        );
        newDecrypted[msg.id] = plaintext;
      }
    }
    
    setDecryptedContents(prev => ({ ...prev, ...newDecrypted }));
  }, [decrypt, getRecipientPublicKey]);

  const fetchMessages = async () => {
    if (!conversationId || !user) return;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const mapped = (data || []).map(msg => ({ ...msg, isMine: msg.sender_id === user.id })) as ChatMessage[];
      setMessages(mapped);
      
      // Decrypt any encrypted messages
      await decryptMessages(mapped);
      
      // Mark messages as read and update read_at timestamp
      await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .is('read_at', null);
    } catch (error) { 
      console.error('Error fetching messages:', error); 
    } finally { 
      setLoading(false); 
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase.channel(`conversation-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const newMsg = payload.new as any;
          const chatMsg = { ...newMsg, isMine: newMsg.sender_id === user?.id } as ChatMessage;
          setMessages(prev => [...prev, chatMsg]);
          
          // Decrypt if encrypted
          if (newMsg.is_encrypted && newMsg.ciphertext) {
            await decryptMessages([chatMsg]);
          }
          
          if (newMsg.sender_id !== user?.id) {
            supabase.from('messages').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', newMsg.id);
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const updated = payload.new as any;
          setMessages(prev => prev.map(msg => 
            msg.id === updated.id ? { ...msg, ...updated, isMine: msg.isMine } : msg
          ));
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.user_id !== user?.id && updated.typing_at) {
            const isRecentlyTyping = new Date().getTime() - new Date(updated.typing_at).getTime() < 5000;
            setIsTyping(isRecentlyTyping);
            if (isRecentlyTyping) setTimeout(() => setIsTyping(false), 5000);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const fetchCallLogs = async () => {
    if (!conversationId) return;
    const { data } = await (supabase as any)
      .from('calls')
      .select('id, caller_id, callee_id, call_type, status, started_at, ended_at, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (data) setCallLogs(data as CallLogEntry[]);
  };

  const subscribeToCalls = () => {
    const channel = supabase
      .channel(`calls-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls', filter: `conversation_id=eq.${conversationId}` },
        (payload) => setCallLogs(prev => [...prev, payload.new as CallLogEntry]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'calls', filter: `conversation_id=eq.${conversationId}` },
        (payload) => setCallLogs(prev => prev.map(c => c.id === (payload.new as any).id ? { ...c, ...(payload.new as any) } : c)))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString(), content: '' } as any)
      .eq('id', messageId);
    if (error) toast.error('Could not delete message');
    else setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deleted_at: new Date().toISOString(), content: '' } as any : m));
  };

  const startEditMessage = (msg: ChatMessage) => {
    const current = (msg as any).is_encrypted ? decryptedContents[msg.id] || '' : msg.content || '';
    setEditingId(msg.id);
    setEditingText(current);
  };

  const cancelEditMessage = () => { setEditingId(null); setEditingText(''); };

  const saveEditMessage = async () => {
    if (!editingId) return;
    const trimmed = editingText.trim();
    if (!trimmed) { cancelEditMessage(); return; }
    const target = messages.find(m => m.id === editingId);
    if (!target) { cancelEditMessage(); return; }
    if ((target as any).is_encrypted) {
      toast.error('Encrypted messages can\'t be edited yet');
      cancelEditMessage();
      return;
    }
    const { error } = await supabase
      .from('messages')
      .update({ content: trimmed, edited_at: new Date().toISOString() } as any)
      .eq('id', editingId);
    if (error) {
      toast.error('Could not edit message');
      return;
    }
    setMessages(prev => prev.map(m => m.id === editingId ? { ...m, content: trimmed, edited_at: new Date().toISOString() } as any : m));
    cancelEditMessage();
  };


  const handleTyping = async () => {
    if (!user || !conversationId) return;
    await supabase.from('conversation_participants').update({ typing_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', user.id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      await supabase.from('conversation_participants').update({ typing_at: null }).eq('conversation_id', conversationId).eq('user_id', user.id);
    }, 5000);
  };

  const handleSendMessage = async (content?: string, messageType: string = 'text', mediaUrl?: string, voiceDuration?: number, isViewOnce?: boolean) => {
    const messageContent = content || newMessage.trim();
    if (!messageContent && !mediaUrl) return;
    if (!user || !conversationId) return;

    setSending(true);
    setNewMessage('');
    try {
      // For text messages in 1-on-1 chats, use E2EE
      const isGroupChat = conversation?.is_group;
      const recipientId = !isGroupChat && participant?.id;
      
      if (messageType === 'text' && recipientId && encryptionReady) {
        let expiresAt: string | undefined;
        if (conversation?.disappearing_messages_timer) {
          const d = new Date();
          d.setHours(d.getHours() + conversation.disappearing_messages_timer);
          expiresAt = d.toISOString();
        }
        
        const success = await sendEncrypted(conversationId, messageContent, recipientId, {
          messageType: messageType !== 'text' ? messageType : undefined,
          mediaUrl,
          voiceDuration,
          isViewOnce,
          expiresAt,
        });
        
        if (success) {
          // Cache decrypted content for our own message
          // (we know what we sent)
          await supabase.from('conversation_participants').update({ typing_at: null }).eq('conversation_id', conversationId).eq('user_id', user.id);
        }
      } else {
        // Fallback: unencrypted (group chats, media, etc.)
        const insertData: any = { conversation_id: conversationId, sender_id: user.id, content: messageContent || (messageType === 'voice' ? '🎤 Voice message' : '📷 Media'), is_encrypted: false };
        if (messageType !== 'text') insertData.message_type = messageType;
        if (mediaUrl) insertData.media_url = mediaUrl;
        if (voiceDuration) insertData.voice_duration = voiceDuration;
        if (isViewOnce) insertData.is_view_once = true;

        if (conversation?.disappearing_messages_timer) {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + conversation.disappearing_messages_timer);
          insertData.expires_at = expiresAt.toISOString();
        }

        await supabase.from('messages').insert(insertData);
        await supabase.from('conversation_participants').update({ typing_at: null }).eq('conversation_id', conversationId).eq('user_id', user.id);
        await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
      }
    } catch (error) { console.error('Error sending message:', error); setNewMessage(messageContent); } 
    finally { setSending(false); }
  };

  const handleMediaSend = async (mediaUrl: string, mediaType: string, isViewOnce: boolean, caption?: string) => {
    await handleSendMessage(caption || '', isViewOnce ? 'view_once' : 'image', mediaUrl, undefined, isViewOnce);
  };

  const handleVoiceSend = async (blob: Blob, duration: number) => {
    try {
      const fileName = `voice_${Date.now()}.webm`;
      const { data, error } = await supabase.storage.from('media').upload(`voice/${user?.id}/${fileName}`, blob);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(data.path);
      await handleSendMessage('🎤 Voice message', 'voice', urlData.publicUrl, duration);
    } catch (error) { console.error('Error uploading voice:', error); toast.error('Failed to send voice message'); }
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const showAvatar = !message.isMine && (index === 0 || messages[index - 1]?.sender_id !== message.sender_id);
    const messageType = message.message_type || 'text';
    const senderProfile = participants.find(p => p.id === message.sender_id) || participant;

    // View once media
    if (messageType === 'view_once' && message.is_view_once) {
      return (
        <div key={message.id} className={cn("flex items-end gap-2", message.isMine ? "justify-end" : "justify-start")}>
          {!message.isMine && showAvatar && senderProfile && (
            <Avatar className="w-8 h-8">
              <AvatarImage src={senderProfile.avatar_url || undefined} />
              <AvatarFallback>{senderProfile.username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          {!message.isMine && !showAvatar && <div className="w-8" />}
          <ViewOnceMedia
            messageId={message.id}
            mediaUrl={message.media_url!}
            mediaType={(message.media_type as 'image' | 'video') || 'image'}
            isViewed={!!message.viewed_at}
            isMine={message.isMine}
            senderId={message.sender_id}
          />
        </div>
      );
    }

    // Regular media
    if ((messageType === 'image' || messageType === 'video') && message.media_url) {
      return (
        <div key={message.id} className={cn("flex items-end gap-2", message.isMine ? "justify-end" : "justify-start")}>
          {!message.isMine && showAvatar && senderProfile && (
            <Avatar className="w-8 h-8">
              <AvatarImage src={senderProfile.avatar_url || undefined} />
              <AvatarFallback>{senderProfile.username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          )}
          {!message.isMine && !showAvatar && <div className="w-8" />}
          <div className={cn("max-w-[70%] rounded-2xl overflow-hidden", message.isMine ? "bg-primary" : "bg-muted")}>
            <MediaMessage
              mediaUrl={message.media_url}
              mediaType={(message.media_type as 'image' | 'video') || 'image'}
              caption={message.content !== '📷 Media' ? message.content : undefined}
              isMine={message.isMine}
            />
          </div>
        </div>
      );
    }

    const isEncrypted = (message as any).is_encrypted;
    const displayContent = isEncrypted && decryptedContents[message.id] 
      ? decryptedContents[message.id]
      : isEncrypted ? '🔒 Encrypted message' : message.content;

    return (
      <div key={message.id} className={cn("flex items-end gap-2", message.isMine ? "justify-end" : "justify-start")}>
        {!message.isMine && <div className="w-8">{showAvatar && senderProfile && <Avatar className="w-8 h-8"><AvatarImage src={senderProfile.avatar_url || undefined} /><AvatarFallback>{senderProfile.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>}</div>}
        <div className={cn("max-w-[70%] px-4 py-2 rounded-2xl", message.isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md")}>
          {messageType === 'voice' && message.media_url ? <VoiceMessage audioUrl={message.media_url} duration={message.voice_duration} isMine={message.isMine} />
          : message.shared_post_id || message.shared_reel_id || message.shared_profile_id ? <SharedPostPreview postId={message.shared_post_id} reelId={message.shared_reel_id} profileId={message.shared_profile_id} isMine={message.isMine} />
          : (
            <div>
              <p className="text-sm whitespace-pre-wrap break-words">{displayContent}</p>
              {isEncrypted && (
                <div className="flex items-center gap-1 mt-1 opacity-60">
                  <Lock className="w-3 h-3" />
                  <span className="text-[10px]">end-to-end encrypted</span>
                </div>
              )}
            </div>
          )}
        </div>
        {message.isMine && (
          <div className="w-4 flex items-center justify-center">
            {message.read_at || message.is_read ? (
              <CheckCheck className="w-3.5 h-3.5 text-primary" />
            ) : message.delivered_at ? (
              <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <Check className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        )}
      </div>
    );
  };

  if (!user) return <div className="h-screen flex items-center justify-center"><p>Please sign in</p></div>;

  const isGroupChat = conversation?.is_group;
  const displayName = isGroupChat ? conversation?.group_name : participant?.username;
  const displayAvatar = isGroupChat ? conversation?.group_avatar_url : participant?.avatar_url;

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-3 flex items-center gap-3">
        <button onClick={() => navigate('/messages')}><ArrowLeft className="w-6 h-6" /></button>
        
        {participant || isGroupChat ? (
          <button 
            onClick={() => !isGroupChat && setShowProfileView(true)} 
            className="flex items-center gap-3 flex-1 text-left"
          >
            <div className="relative">
              {isGroupChat ? (
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              ) : (
                <Avatar className="w-10 h-10">
                  <AvatarImage src={displayAvatar || undefined} />
                  <AvatarFallback>{(displayName || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
              {!isGroupChat && participant && isUserOnline(participant.id) && (
                <OnlineIndicator isOnline={true} size="sm" className="absolute bottom-0 right-0" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="font-medium">{displayName}</p>
                {!isGroupChat && participant?.is_verified && <VerifiedBadge size="sm" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {isTyping ? (
                  <span className="text-primary animate-pulse">typing...</span>
                ) : isGroupChat ? (
                  `${participants.length + 1} members`
                ) : participant ? (
                  getLastSeenText(participant.id) || ''
                ) : ''}
              </p>
            </div>
          </button>
        ) : <Skeleton className="w-24 h-4" />}

        <div className="flex items-center gap-2">
          {!isGroupChat && participant && (
            <>
              <Button
                variant="ghost"
                size="icon"
                disabled={startingCall}
                onClick={() =>
                  startCall({
                    calleeId: participant.id,
                    conversationId: conversationId ?? null,
                    type: 'voice',
                  })
                }
                aria-label="Start voice call"
              >
                <Phone className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={startingCall}
                onClick={() =>
                  startCall({
                    calleeId: participant.id,
                    conversationId: conversationId ?? null,
                    type: 'video',
                  })
                }
                aria-label="Start video call"
              >
                <Video className="w-5 h-5" />
              </Button>
            </>
          )}
          {isGroupChat && conversation ? (
            <GroupChatSettings
              conversationId={conversationId!}
              groupName={conversation.group_name || 'Group'}
              groupAvatarUrl={conversation.group_avatar_url}
              isAdmin={isAdmin}
              disappearingTimer={conversation.disappearing_messages_timer}
              onLeave={() => navigate('/messages')}
              onUpdate={fetchConversation}
            />
          ) : (
            <Button variant="ghost" size="icon" onClick={() => setShowBlockReport(true)}><MoreVertical className="w-5 h-5" /></Button>
          )}
        </div>
      </div>

      {/* Profile View Dialog */}
      {participant && !isGroupChat && (
        <ProfileViewDialog
          open={showProfileView}
          onOpenChange={setShowProfileView}
          profile={participant}
          isOnline={isUserOnline(participant.id)}
        />
      )}

      {participant && !isGroupChat && (
        <BlockReportSheet open={showBlockReport} onOpenChange={setShowBlockReport} targetUserId={participant.id} targetUsername={participant.username} onBlocked={() => navigate('/messages')} />
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* E2EE banner */}
        {!isGroupChat && encryptionReady && (
          <div className="flex items-center justify-center gap-2 py-2 px-4 mx-auto max-w-xs rounded-full bg-accent/50 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Messages are end-to-end encrypted</span>
          </div>
        )}

        {/* Disappearing messages indicator */}
        {conversation?.disappearing_messages_timer && (
          <DisappearingMessagesIndicator timer={conversation.disappearing_messages_timer} />
        )}

        {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}><Skeleton className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-40" : "w-32")} /></div>)
        : messages.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><p>No messages yet</p></div>
        : messages.map((message, index) => renderMessage(message, index))}
        <div ref={messagesEndRef} />
      </div>

      <div className="sticky bottom-0 bg-background border-t border-border p-3">
        <div className="flex items-center gap-2">
          <ChatMediaInput onSend={handleMediaSend} disabled={sending} />
          <Input ref={inputRef} placeholder={encryptionReady ? "🔒 Encrypted message..." : "Message..."} value={newMessage} onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}} className="flex-1" />
          {newMessage.trim() ? <Button size="icon" onClick={() => handleSendMessage()} disabled={sending}><Send className="w-5 h-5" /></Button> : <VoiceRecordButton onSend={handleVoiceSend} disabled={sending} />}
        </div>
      </div>
    </div>
  );
}