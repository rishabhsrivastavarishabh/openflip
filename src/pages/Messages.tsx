import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { PenSquare, Search, Users, HelpCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Seo } from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OnlineIndicator } from '@/components/messages/OnlineIndicator';
import { NewMessageModal } from '@/components/messages/NewMessageModal';
import { MessageSearch } from '@/components/messages/MessageSearch';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface ConversationItem {
  id: string;
  updated_at: string;
  participant: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  last_message: string | null;
  unread_count: number;
  last_sender_id: string | null;
  is_group?: boolean;
  group_name?: string;
  group_avatar_url?: string;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const { fetchOnlineStatus, subscribeToOnlineStatus, isUserOnline } = useOnlineStatus();

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    // Get all conversations with their details including group info
    const { data: participations, error } = await supabase
      .from('conversation_participants')
      .select(`conversation_id, conversations(id, updated_at, is_group, group_name, group_avatar_url)`)
      .eq('user_id', user.id);

    if (error || !participations) {
      setLoading(false);
      return;
    }

    const conversationIds = participations.map((p: any) => p.conversation_id);

    if (conversationIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds)
      .neq('user_id', user.id);

    const otherUserIds = Array.from(
      new Set((allParticipants || []).map((p: any) => p.user_id).filter(Boolean))
    );

    let profilesById: Record<string, { id: string; username: string; avatar_url: string | null }> = {};
    if (otherUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', otherUserIds);
      (profiles || []).forEach((p: any) => {
        profilesById[p.id] = { id: p.id, username: p.username, avatar_url: p.avatar_url };
      });
    }

    const { data: messages } = await supabase
      .from('messages')
      .select('conversation_id, content, created_at, sender_id, is_read')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false });

    const lastMessages: Record<string, { content: string; sender_id: string }> = {};
    const unreadCounts: Record<string, number> = {};
    
    messages?.forEach((m: any) => {
      if (!lastMessages[m.conversation_id]) {
        lastMessages[m.conversation_id] = { content: m.content, sender_id: m.sender_id };
      }
      if (!m.is_read && m.sender_id !== user.id) {
        unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1;
      }
    });

    const conversationsData = participations.map((p: any) => {
      const convo = p.conversations;
      const isGroup = convo?.is_group || false;
      const otherParticipants = (allParticipants || []).filter(
        (op: any) => op.conversation_id === p.conversation_id
      );

      const firstOtherId = otherParticipants[0]?.user_id;
      const firstParticipant =
        (firstOtherId && profilesById[firstOtherId]) ||
        { id: firstOtherId || '', username: 'Unknown', avatar_url: null };

      return {
        id: p.conversation_id,
        updated_at: convo?.updated_at || '',
        participant: firstParticipant,
        last_message: lastMessages[p.conversation_id]?.content || null,
        last_sender_id: lastMessages[p.conversation_id]?.sender_id || null,
        unread_count: unreadCounts[p.conversation_id] || 0,
        is_group: isGroup,
        group_name: convo?.group_name || null,
        group_avatar_url: convo?.group_avatar_url || null,
      } as ConversationItem;
    });


    conversationsData.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    setConversations(conversationsData);
    setLoading(false);

    // Fetch online status for all participants (for 1-on-1 chats)
    const participantIds = conversationsData
      .filter(c => !c.is_group)
      .map(c => c.participant.id)
      .filter(Boolean);
    if (participantIds.length > 0) {
      fetchOnlineStatus(participantIds);
    }
  }, [user, fetchOnlineStatus]);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user, fetchConversations]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchConversations())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConversations]);

  // Subscribe to online status
  useEffect(() => {
    const participantIds = conversations.map(c => c.participant.id).filter(Boolean);
    if (participantIds.length > 0) {
      return subscribeToOnlineStatus(participantIds);
    }
  }, [conversations, subscribeToOnlineStatus]);

  const filteredConversations = conversations.filter(c => {
    const searchTerm = searchQuery.toLowerCase();
    if (c.is_group) {
      return c.group_name?.toLowerCase().includes(searchTerm);
    }
    return c.participant.username.toLowerCase().includes(searchTerm);
  });

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4 text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Sign in to message</h2>
          <p className="text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to send and receive messages
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Seo title="Messages — Openflip" description="Private chats and group conversations on Openflip." path="/messages" noindex />
      <div className="max-w-2xl mx-auto">
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-semibold text-lg">Messages</h1>
            <div className="flex items-center gap-1">
              <Link to="/how-it-works">
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => setShowMessageSearch(true)}>
                <Search className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setShowNewMessage(true)}>
                <PenSquare className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </header>

        <div className="divide-y divide-border">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map(conversation => (
              <Link
                key={conversation.id}
                to={`/messages/${conversation.id}`}
                className="flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="relative">
                  {conversation.is_group ? (
                    <div className="h-14 w-14 bg-primary/10 rounded-full flex items-center justify-center">
                      {conversation.group_avatar_url ? (
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={conversation.group_avatar_url} />
                          <AvatarFallback className="bg-primary/10 text-primary text-lg">
                            <Users className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <Users className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  ) : (
                    <>
                      <Avatar className="h-14 w-14">
                        <AvatarImage src={conversation.participant.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {conversation.participant.username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isUserOnline(conversation.participant.id) && (
                        <OnlineIndicator isOnline={true} size="md" className="absolute bottom-0 right-0" />
                      )}
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${conversation.unread_count > 0 ? 'text-foreground' : ''}`}>
                      {conversation.is_group ? conversation.group_name : conversation.participant.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: false })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {conversation.last_message && (
                      <p className={`text-sm truncate flex-1 ${conversation.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {conversation.last_sender_id === user.id && 'You: '}
                        {conversation.last_message}
                      </p>
                    )}
                    {conversation.unread_count > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold rounded-full">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-12">
              <PenSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="font-semibold mb-2">No messages yet</h2>
              <p className="text-sm text-muted-foreground mb-4">Start a conversation with someone</p>
              <Button variant="gradient" onClick={() => setShowNewMessage(true)}>
                New Message
              </Button>
            </div>
          )}
        </div>
      </div>

      <NewMessageModal open={showNewMessage} onOpenChange={setShowNewMessage} />
      <MessageSearch open={showMessageSearch} onOpenChange={setShowMessageSearch} />
    </MainLayout>
  );
}
