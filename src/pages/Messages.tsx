import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { SquarePen, Search, Users, HelpCircle, MessagesSquare, Sparkles, Video, Copy, Pin, PinOff, Trash2, MoreVertical, Archive, ArchiveRestore } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Seo } from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { OnlineIndicator } from '@/components/messages/OnlineIndicator';
import { NewMessageModal } from '@/components/messages/NewMessageModal';
import { MessageSearch } from '@/components/messages/MessageSearch';
import { FromOpenMedia } from '@/components/common/FromOpenMedia';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { toast } from 'sonner';

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
  last_sender_username: string | null;
  is_group?: boolean;
  group_name?: string;
  group_avatar_url?: string;
  is_pinned?: boolean;
  is_archived?: boolean;
}

type Filter = 'all' | 'unread' | 'groups' | 'archived';

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const { fetchOnlineStatus, subscribeToOnlineStatus, isUserOnline } = useOnlineStatus();
  const [pendingDelete, setPendingDelete] = useState<ConversationItem | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!user) return;

    const { data: participations, error } = await supabase
      .from('conversation_participants')
      .select(`conversation_id, is_pinned, is_archived, conversations(id, updated_at, is_group, group_name, group_avatar_url)`)
      .eq('user_id', user.id);

    if (error || !participations) {
      if (error) console.error('Messages: failed to load conversations', error);
      setLoading(false);
      return;
    }


    const conversationIds = participations.map((p: any) => p.conversation_id);

    if (conversationIds.length === 0) {
      setLoading(false);
      setConversations([]);
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

    // Resolve profiles for both other participants and last-message senders
    const profileIdsToFetch = Array.from(new Set([
      ...otherUserIds,
      ...Object.values(lastMessages).map(m => m.sender_id).filter(id => id && id !== user.id),
    ]));

    const profilesById: Record<string, { id: string; username: string; avatar_url: string | null }> = {};
    if (profileIdsToFetch.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', profileIdsToFetch);
      (profiles || []).forEach((p: any) => {
        profilesById[p.id] = { id: p.id, username: p.username, avatar_url: p.avatar_url };
      });
    }



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

      const lastSenderId = lastMessages[p.conversation_id]?.sender_id || null;
      const lastSenderUsername = lastSenderId
        ? (lastSenderId === user.id ? null : profilesById[lastSenderId]?.username || null)
        : null;

      return {
        id: p.conversation_id,
        updated_at: convo?.updated_at || '',
        participant: firstParticipant,
        last_message: lastMessages[p.conversation_id]?.content || null,
        last_sender_id: lastSenderId,
        last_sender_username: lastSenderUsername,
        unread_count: unreadCounts[p.conversation_id] || 0,
        is_group: isGroup,
        group_name: convo?.group_name || null,
        group_avatar_url: convo?.group_avatar_url || null,
        is_pinned: !!p.is_pinned,
        is_archived: !!p.is_archived,
      } as ConversationItem;
    });

    conversationsData.sort((a, b) => {
      if ((a.is_pinned ? 1 : 0) !== (b.is_pinned ? 1 : 0)) return a.is_pinned ? -1 : 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    setConversations(conversationsData);
    setLoading(false);

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

  useEffect(() => {
    const participantIds = conversations.map(c => c.participant.id).filter(Boolean);
    if (participantIds.length > 0) {
      return subscribeToOnlineStatus(participantIds);
    }
  }, [conversations, subscribeToOnlineStatus]);

  const totalUnread = useMemo(
    () => conversations.filter(c => !c.is_archived).reduce((sum, c) => sum + c.unread_count, 0),
    [conversations]
  );

  const archivedCount = useMemo(
    () => conversations.filter(c => c.is_archived).length,
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return conversations.filter(c => {
      if (filter === 'archived') {
        if (!c.is_archived) return false;
      } else {
        if (c.is_archived) return false;
        if (filter === 'unread' && c.unread_count === 0) return false;
        if (filter === 'groups' && !c.is_group) return false;
      }
      if (!term) return true;
      if (c.is_group) return c.group_name?.toLowerCase().includes(term);
      return c.participant.username.toLowerCase().includes(term);
    });
  }, [conversations, searchQuery, filter]);

  const onlineFriends = useMemo(() => {
    const seen = new Set<string>();
    const out: ConversationItem[] = [];
    for (const c of conversations) {
      if (c.is_group) continue;
      const pid = c.participant?.id;
      if (!pid || seen.has(pid)) continue;
      if (!isUserOnline(pid)) continue;
      seen.add(pid);
      out.push(c);
      if (out.length >= 10) break;
    }
    return out;
  }, [conversations, isUserOnline]);

  const togglePin = async (c: ConversationItem) => {
    if (!user) return;
    const nextPinned = !c.is_pinned;
    setConversations(prev =>
      [...prev.map(x => x.id === c.id ? { ...x, is_pinned: nextPinned } : x)]
        .sort((a, b) => {
          if ((a.is_pinned ? 1 : 0) !== (b.is_pinned ? 1 : 0)) return a.is_pinned ? -1 : 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        })
    );
    const { error } = await (supabase as any)
      .from('conversation_participants')
      .update({ is_pinned: nextPinned, pinned_at: nextPinned ? new Date().toISOString() : null })
      .eq('conversation_id', c.id)
      .eq('user_id', user.id);
    if (error) {
      toast.error('Failed to update pin');
      fetchConversations();
    } else {
      toast.success(nextPinned ? 'Chat pinned' : 'Chat unpinned');
    }
  };

  const deleteChat = async (c: ConversationItem) => {
    if (!user) return;
    setConversations(prev => prev.filter(x => x.id !== c.id));
    const { error } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', c.id)
      .eq('user_id', user.id);
    if (error) {
      toast.error('Failed to delete chat');
      fetchConversations();
    } else {
      toast.success('Chat deleted');
    }
  };

  const toggleArchive = async (c: ConversationItem) => {
    if (!user) return;
    const nextArchived = !c.is_archived;
    setConversations(prev => prev.map(x => x.id === c.id ? { ...x, is_archived: nextArchived } : x));
    const { error } = await (supabase as any)
      .from('conversation_participants')
      .update({ is_archived: nextArchived, archived_at: nextArchived ? new Date().toISOString() : null })
      .eq('conversation_id', c.id)
      .eq('user_id', user.id);
    if (error) {
      toast.error('Failed to update archive');
      fetchConversations();
    } else {
      toast.success(nextArchived ? 'Chat archived' : 'Chat unarchived');
    }
  };

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
      <Seo title="Messages — Openflip" description="Private one-to-one and group chats on Openflip with end-to-end encryption, voice notes, view-once media, reactions, and instant voice or video calling." path="/messages" noindex />
      <div className="max-w-2xl mx-auto pb-24">
        {/* Header */}
        <header className="sticky top-0 z-40 glass-strong border-b">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-sm">
                  <MessagesSquare className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="font-bold text-xl leading-tight">Messages</h1>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {totalUnread > 0 ? `${totalUnread} unread` : 'All caught up'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link to="/how-it-works">
                  <Button variant="ghost" size="icon" aria-label="Help">
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setShowMessageSearch(true)} aria-label="Search messages">
                  <Search className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Start a group meeting"
                  onClick={() => {
                    const roomId =
                      (globalThis.crypto as any)?.randomUUID?.() ??
                      Math.random().toString(36).slice(2) + Date.now().toString(36);
                    const url = `${window.location.origin}/meet/${roomId}`;
                    try {
                      navigator.clipboard.writeText(url);
                      toast.success('Meeting link copied — share it to invite people');
                    } catch {
                      toast.message(url);
                    }
                    window.location.href = `/meet/${roomId}`;
                  }}
                >
                  <Video className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  onClick={() => setShowNewMessage(true)}
                  aria-label="New message"
                  className="rounded-full gradient-primary shadow-md"
                >
                  <SquarePen className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chats"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-full bg-secondary/60 border-0 focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          </div>

          <div className="px-4 pb-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList className="grid grid-cols-4 w-full h-9 bg-secondary/60 rounded-full p-1">
                <TabsTrigger value="all" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  All
                </TabsTrigger>
                <TabsTrigger value="unread" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Unread {totalUnread > 0 && <span className="ml-1 text-primary">·{totalUnread}</span>}
                </TabsTrigger>
                <TabsTrigger value="groups" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Groups
                </TabsTrigger>
                <TabsTrigger value="archived" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Archived {archivedCount > 0 && <span className="ml-1 text-primary">·{archivedCount}</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </header>

        {/* Active friends row */}
        {onlineFriends.length > 0 && filter === 'all' && !searchQuery && (
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active now</span>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
              {onlineFriends.map(c => (
                <Link
                  key={c.id}
                  to={`/messages/${c.id}`}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-16"
                >
                  <div className="relative">
                    <Avatar className="h-14 w-14 ring-2 ring-primary/40">
                      <AvatarImage src={c.participant.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {c.participant.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <OnlineIndicator isOnline size="md" className="absolute bottom-0 right-0" />
                  </div>
                  <span className="text-[11px] truncate w-full text-center text-muted-foreground">
                    {c.participant.username}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Chat list */}
        <div className="px-2 py-2 space-y-1">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map(conversation => {
              const unread = conversation.unread_count > 0;
              return (
                <div
                  key={conversation.id}
                  className={`group relative flex items-center gap-3 p-3 rounded-2xl transition-all ${
                    unread ? 'bg-primary/[0.04] hover:bg-primary/[0.08]' : 'hover:bg-secondary/60'
                  }`}
                >
                  <Link to={`/messages/${conversation.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="relative shrink-0">
                      {conversation.is_group ? (
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={conversation.group_avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                            <Users className="h-6 w-6" />
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <>
                          <Avatar className="h-14 w-14">
                            <AvatarImage src={conversation.participant.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-lg">
                              {conversation.participant.username.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {isUserOnline(conversation.participant.id) && (
                            <OnlineIndicator isOnline size="md" className="absolute bottom-0 right-0 ring-2 ring-background" />
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate flex items-center gap-1 ${unread ? 'font-bold text-foreground' : 'font-semibold'}`}>
                          {conversation.is_pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                          {conversation.is_group ? conversation.group_name : conversation.participant.username}
                        </span>
                        <span className={`text-[11px] shrink-0 ${unread ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                          {conversation.updated_at
                            ? formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: false })
                            : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className={`text-sm truncate flex-1 ${unread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                          {conversation.last_message ? (
                            <>
                              {conversation.last_sender_id === user.id ? (
                                <span className="opacity-70">You: </span>
                              ) : conversation.is_group && conversation.last_sender_username ? (
                                <span className="opacity-70">{conversation.last_sender_username}: </span>
                              ) : null}
                              {conversation.last_message}
                            </>
                          ) : (
                            <span className="italic opacity-60">Say hi 👋</span>
                          )}
                        </p>
                        {unread && (
                          <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center gradient-primary text-primary-foreground text-[11px] font-bold rounded-full shadow-sm">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-60 hover:opacity-100" aria-label="Chat options" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => togglePin(conversation)}>
                        {conversation.is_pinned ? (
                          <><PinOff className="h-4 w-4 mr-2" />Unpin chat</>
                        ) : (
                          <><Pin className="h-4 w-4 mr-2" />Pin chat</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleArchive(conversation)}>
                        {conversation.is_archived ? (
                          <><ArchiveRestore className="h-4 w-4 mr-2" />Unarchive</>
                        ) : (
                          <><Archive className="h-4 w-4 mr-2" />Archive chat</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setPendingDelete(conversation)}>
                        <Trash2 className="h-4 w-4 mr-2" />Delete chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-primary/10 flex items-center justify-center bg-primary/10">
                <MessagesSquare className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-semibold mb-1">
                {filter === 'unread' ? 'No unread messages' : filter === 'groups' ? 'No group chats' : filter === 'archived' ? 'No archived chats' : 'No messages yet'}
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                {filter === 'all' ? 'Start a conversation with someone' : 'Try switching to another tab'}
              </p>
              {filter === 'all' && (
                <Button variant="gradient" onClick={() => setShowNewMessage(true)} className="rounded-full">
                  <SquarePen className="h-4 w-4" />
                  New Message
                </Button>
              )}
            </div>
          )}
        </div>

        <FromOpenMedia compact className="px-4 pb-6" />
      </div>

      <NewMessageModal open={showNewMessage} onOpenChange={setShowNewMessage} />
      <MessageSearch open={showMessageSearch} onOpenChange={setShowMessageSearch} />
      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the conversation from your list. Messages you already received stay on the other person's device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (pendingDelete) deleteChat(pendingDelete); setPendingDelete(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
