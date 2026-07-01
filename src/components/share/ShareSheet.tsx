import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Copy, Send, ExternalLink, Check, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'post' | 'reel' | 'profile';
  itemId: string;
  itemUrl?: string;
}

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  conversationId?: string;
}

export function ShareSheet({ open, onOpenChange, type, itemId, itemUrl }: ShareSheetProps) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const shareUrl = itemUrl || `${window.location.origin}/${type}/${itemId}`;

  useEffect(() => {
    if (open && user) {
      fetchFriends();
    }
  }, [open, user]);

  const fetchFriends = async () => {
    if (!user) return;

    try {
      // Get followers and following
      const [{ data: followers }, { data: following }] = await Promise.all([
        supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', user.id),
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id),
      ]);

      const friendIds = new Set([
        ...(followers?.map(f => f.follower_id) || []),
        ...(following?.map(f => f.following_id) || []),
      ]);

      if (friendIds.size === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', Array.from(friendIds));

      // Get existing conversations
      const { data: myConversations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      const myConvoIds = myConversations?.map(c => c.conversation_id) || [];

      const friendsWithConvos: Friend[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          let conversationId: string | undefined;
          
          if (myConvoIds.length > 0) {
            const { data: existingConvo } = await supabase
              .from('conversation_participants')
              .select('conversation_id')
              .eq('user_id', profile.id)
              .in('conversation_id', myConvoIds)
              .maybeSingle();
            
            conversationId = existingConvo?.conversation_id;
          }

          return {
            ...profile,
            conversationId,
          };
        })
      );

      setFriends(friendsWithConvos);
    } catch (error) {
      console.error('Error fetching friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleShareToChat = async (friend: Friend) => {
    if (!user) return;

    setSharing(friend.id);

    try {
      let conversationId = friend.conversationId;

      // Create conversation if doesn't exist
      if (!conversationId) {
        const { data: newConvo, error: convoError } = await supabase
          .from('conversations')
          .insert({})
          .select()
          .single();

        if (convoError) throw convoError;

        await supabase.from('conversation_participants').insert([
          { conversation_id: newConvo.id, user_id: user.id },
          { conversation_id: newConvo.id, user_id: friend.id },
        ]);

        conversationId = newConvo.id;
      }

      // Send share message with proper content type
      const messageData: any = {
        conversation_id: conversationId,
        sender_id: user.id,
        content: type === 'profile' 
          ? `Check out this profile!`
          : `Shared a ${type}`,
        message_type: 'shared_content',
      };

      // Add proper reference based on type
      if (type === 'post') {
        messageData.shared_post_id = itemId;
      } else if (type === 'reel') {
        messageData.shared_reel_id = itemId;
      } else if (type === 'profile') {
        messageData.shared_profile_id = itemId;
      }

      await (supabase as any).from('messages').insert(messageData);

      // Create notification for the recipient
      await supabase.from('notifications').insert({
        user_id: friend.id,
        actor_id: user.id,
        type: 'message',
      });

      // Track share
      if (type !== 'profile') {
        await (supabase as any).from('shares').insert({
          user_id: user.id,
          [type === 'post' ? 'post_id' : 'reel_id']: itemId,
          shared_to_user_id: friend.id,
          share_type: 'chat',
        });
      }

      toast.success(`Shared with ${friend.username}`);
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Failed to share');
    } finally {
      setSharing(null);
    }
  };

  const handleExternalShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Openflip ${type}`,
          url: shareUrl,
        });
        
        if (user && type !== 'profile') {
          await (supabase as any).from('shares').insert({
            user_id: user.id,
            [type === 'post' ? 'post_id' : 'reel_id']: itemId,
            share_type: 'external',
          });
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const filteredFriends = friends.filter(f =>
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Share</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Quick actions */}
          <div className="flex gap-4">
            <button
              onClick={handleCopyLink}
              className="flex flex-col items-center gap-2 flex-1 py-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              {copied ? (
                <Check className="w-6 h-6 text-primary" />
              ) : (
                <Copy className="w-6 h-6" />
              )}
              <span className="text-xs">Copy link</span>
            </button>
            <button
              onClick={handleExternalShare}
              className="flex flex-col items-center gap-2 flex-1 py-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <ExternalLink className="w-6 h-6" />
              <span className="text-xs">More options</span>
            </button>
          </div>

          {/* Search friends */}
          {user && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Friends list */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1">
                        <div className="w-24 h-4 bg-muted rounded animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : filteredFriends.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    {searchQuery ? 'No friends found' : 'Follow users to share with them'}
                  </p>
                ) : (
                  filteredFriends.map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleShareToChat(friend)}
                      disabled={sharing === friend.id}
                      className={cn(
                        "flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted transition-colors",
                        sharing === friend.id && "opacity-50"
                      )}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={friend.avatar_url || undefined} />
                        <AvatarFallback>{friend.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-left font-medium">{friend.username}</span>
                      <Send className={cn(
                        "w-5 h-5",
                        sharing === friend.id && "animate-pulse text-primary"
                      )} />
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
