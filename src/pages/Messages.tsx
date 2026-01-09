import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { PenSquare, Search } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
}

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    const { data: participations, error } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        conversations(id, updated_at)
      `)
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

    // Get other participants
    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        user_id,
        profiles(id, username, avatar_url)
      `)
      .in('conversation_id', conversationIds)
      .neq('user_id', user.id);

    // Get last messages
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
      // Count unread messages not sent by current user
      if (!m.is_read && m.sender_id !== user.id) {
        unreadCounts[m.conversation_id] = (unreadCounts[m.conversation_id] || 0) + 1;
      }
    });

    const conversationsData = participations.map((p: any) => {
      const otherParticipant = allParticipants?.find(
        (op: any) => op.conversation_id === p.conversation_id
      );

      return {
        id: p.conversation_id,
        updated_at: p.conversations?.updated_at || '',
        participant: otherParticipant?.profiles || {
          id: '',
          username: 'Unknown',
          avatar_url: null,
        },
        last_message: lastMessages[p.conversation_id]?.content || null,
        last_sender_id: lastMessages[p.conversation_id]?.sender_id || null,
        unread_count: unreadCounts[p.conversation_id] || 0,
      } as ConversationItem;
    });

    // Sort by updated_at descending
    conversationsData.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    setConversations(conversationsData);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, fetchConversations]);

  // Subscribe to new messages for real-time updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConversations]);

  const filteredConversations = conversations.filter(c =>
    c.participant.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="max-w-2xl mx-auto">
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-semibold text-lg">Messages</h1>
            <Button variant="ghost" size="icon">
              <PenSquare className="h-5 w-5" />
            </Button>
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
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={conversation.participant.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {conversation.participant.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${conversation.unread_count > 0 ? 'text-foreground' : ''}`}>
                      {conversation.participant.username}
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
              <h3 className="font-semibold mb-2">No messages yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start a conversation with someone from their profile
              </p>
              <Button asChild variant="gradient">
                <Link to="/explore">Find people</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
