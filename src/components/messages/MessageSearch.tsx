import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface SearchResult {
  id: string;
  content: string;
  created_at: string;
  conversation_id: string;
  sender: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

interface MessageSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MessageSearch({ open, onOpenChange }: MessageSearchProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      searchMessages(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const searchMessages = async (searchQuery: string) => {
    if (!user) return;
    setLoading(true);

    try {
      // Get user's conversation IDs
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const conversationIds = participations?.map(p => p.conversation_id) || [];

      if (conversationIds.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Search messages
      const { data: messages } = await supabase
        .from('messages')
        .select('id, content, created_at, conversation_id, sender_id')
        .in('conversation_id', conversationIds)
        .ilike('content', `%${searchQuery}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!messages || messages.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      // Get sender profiles
      const senderIds = [...new Set(messages.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', senderIds);

      const profilesMap: Record<string, any> = {};
      profiles?.forEach(p => { profilesMap[p.id] = p; });

      const enrichedResults = messages.map(m => ({
        id: m.id,
        content: m.content,
        created_at: m.created_at || '',
        conversation_id: m.conversation_id,
        sender: profilesMap[m.sender_id] || { id: m.sender_id, username: 'Unknown', avatar_url: null }
      }));

      setResults(enrichedResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    navigate(`/messages/${result.conversation_id}?highlight=${result.id}`);
    onOpenChange(false);
    setQuery('');
    setResults([]);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-primary/30 rounded">{part}</mark> : part
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Messages
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in all conversations..."
            className="pl-9 pr-9"
            autoFocus
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setQuery('')}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length > 0 ? (
            results.map(result => (
              <button
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted rounded-lg transition-colors"
              >
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={result.sender.avatar_url || undefined} />
                  <AvatarFallback>{result.sender.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{result.sender.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(result.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {highlightMatch(result.content, query)}
                  </p>
                </div>
              </button>
            ))
          ) : query.trim() ? (
            <div className="py-8 text-center text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No messages found</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
