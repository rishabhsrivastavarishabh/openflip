import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConversation } from '@/hooks/useConversation';
import { OnlineIndicator } from './OnlineIndicator';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';

interface NewMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserResult {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

export function NewMessageModal({ open, onOpenChange }: NewMessageModalProps) {
  const { user } = useAuth();
  const { startConversation, createGroupChat } = useConversation();
  const { fetchOnlineStatus, isUserOnline } = useOnlineStatus();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open && searchQuery.length >= 2) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery, open]);

  useEffect(() => {
    if (users.length > 0) {
      fetchOnlineStatus(users.map(u => u.id));
    }
  }, [users, fetchOnlineStatus]);

  const searchUsers = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_verified')
        .neq('id', user.id)
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(20);

      if (error) throw error;

      // Filter out blocked users
      const { data: blocked } = await (supabase as any)
        .from('blocked_users')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

      const blockedIds = new Set([
        ...(blocked?.filter((b: any) => b.blocker_id === user.id).map((b: any) => b.blocked_id) || []),
        ...(blocked?.filter((b: any) => b.blocked_id === user.id).map((b: any) => b.blocker_id) || []),
      ]);

      setUsers((data || []).filter(u => !blockedIds.has(u.id)));
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (selectedUser: UserResult) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === selectedUser.id);
      if (isSelected) {
        return prev.filter(u => u.id !== selectedUser.id);
      }
      return [...prev, selectedUser];
    });
  };

  const handleStartChat = async () => {
    if (selectedUsers.length === 0) return;

    setIsCreating(true);
    try {
      if (selectedUsers.length === 1) {
        // 1-on-1 chat
        await startConversation(selectedUsers[0].id);
      } else {
        // Group chat
        const name = groupName || selectedUsers.map(u => u.username).join(', ');
        const conversationId = await createGroupChat(name, selectedUsers.map(u => u.id));
        if (conversationId) {
          onOpenChange(false);
          // Navigate handled in createGroupChat
        }
      }
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setUsers([]);
    setSelectedUsers([]);
    setGroupName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>

        {/* Selected users */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2 border-b">
            {selectedUsers.map(selectedUser => (
              <div
                key={selectedUser.id}
                className="flex items-center gap-1 bg-primary/10 text-primary rounded-full pl-1 pr-2 py-1"
              >
                <Avatar className="h-5 w-5">
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">{selectedUser.username}</span>
                <button
                  onClick={() => toggleUserSelection(selectedUser)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Group name input (if multiple selected) */}
        {selectedUsers.length > 1 && (
          <Input
            placeholder="Group name (optional)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="mb-2"
          />
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-[200px] -mx-6 px-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length > 0 ? (
            <div className="space-y-1">
              {users.map(u => {
                const isSelected = selectedUsers.some(s => s.id === u.id);
                
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUserSelection(u)}
                    className={cn(
                      "flex items-center gap-3 w-full p-2 rounded-lg transition-colors",
                      isSelected ? "bg-primary/10" : "hover:bg-muted"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback>{u.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      {isUserOnline(u.id) && (
                        <OnlineIndicator
                          isOnline={true}
                          size="sm"
                          className="absolute bottom-0 right-0"
                        />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{u.username}</span>
                        {u.is_verified && (
                          <CheckCircle2 className="h-4 w-4 text-primary fill-primary" />
                        )}
                      </div>
                      {u.full_name && (
                        <p className="text-sm text-muted-foreground">{u.full_name}</p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : searchQuery.length >= 2 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Search for users to message
            </div>
          )}
        </div>

        {/* Action button */}
        {selectedUsers.length > 0 && (
          <Button
            onClick={handleStartChat}
            disabled={isCreating}
            className="mt-2"
          >
            {isCreating ? 'Starting...' : selectedUsers.length === 1 ? 'Chat' : 'Create Group'}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
