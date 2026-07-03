import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Camera, UserPlus, UserMinus, Crown, LogOut, Bell, Clock, Trash2, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface GroupMember {
  user_id: string;
  is_admin: boolean;
  profile: {
    id: string;
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

interface GroupChatSettingsProps {
  conversationId: string;
  groupName: string;
  groupAvatarUrl: string | null;
  isAdmin: boolean;
  disappearingTimer: number | null;
  onLeave: () => void;
  onUpdate: () => void;
}

export function GroupChatSettings({
  conversationId,
  groupName,
  groupAvatarUrl,
  isAdmin,
  disappearingTimer,
  onLeave,
  onUpdate,
}: GroupChatSettingsProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(groupName);
  const [timer, setTimer] = useState(disappearingTimer?.toString() || 'off');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, conversationId]);

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('conversation_participants')
      .select('user_id, is_admin')
      .eq('conversation_id', conversationId);

    if (data) {
      const userIds = data.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, is_verified')
        .in('id', userIds);

      setMembers(
        data.map(p => ({
          ...p,
          profile: profiles?.find(pr => pr.id === p.user_id) || {
            id: p.user_id,
            username: 'Unknown',
            avatar_url: null,
            is_verified: false,
          },
        }))
      );
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    setLoading(true);

    try {
      await (supabase as any)
        .from('conversations')
        .update({ group_name: newName })
        .eq('id', conversationId);

      setEditingName(false);
      onUpdate();
      toast.success('Group name updated');
    } catch (error) {
      toast.error('Failed to update group name');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    try {
      const fileName = `group_${conversationId}_${Date.now()}`;
      const { error } = await supabase.storage
        .from('media')
        .upload(`groups/${fileName}`, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(`groups/${fileName}`);

      await (supabase as any)
        .from('conversations')
        .update({ group_avatar_url: publicUrl })
        .eq('id', conversationId);

      onUpdate();
      toast.success('Group avatar updated');
    } catch (error) {
      toast.error('Failed to update avatar');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (memberId: string, currentlyAdmin: boolean) => {
    if (!isAdmin) return;

    try {
      await supabase
        .from('conversation_participants')
        .update({ is_admin: !currentlyAdmin })
        .eq('conversation_id', conversationId)
        .eq('user_id', memberId);

      fetchMembers();
      toast.success(currentlyAdmin ? 'Removed admin rights' : 'Made admin');
    } catch (error) {
      toast.error('Failed to update member');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin) return;

    try {
      await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', memberId);

      fetchMembers();
      toast.success('Member removed');
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const handleTimerChange = async (value: string) => {
    setTimer(value);
    const timerValue = value === 'off' ? null : parseInt(value);

    try {
      await (supabase as any)
        .from('conversations')
        .update({ disappearing_messages_timer: timerValue })
        .eq('id', conversationId);

      onUpdate();
      toast.success(timerValue ? `Messages will disappear after ${timerValue} hours` : 'Disappearing messages disabled');
    } catch (error) {
      toast.error('Failed to update timer');
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;

    try {
      await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      setOpen(false);
      onLeave();
      toast.success('Left group');
    } catch (error) {
      toast.error('Failed to leave group');
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5" />
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Group Settings</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Group Avatar & Name */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarImage src={groupAvatarUrl || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {groupName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isAdmin && (
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-background"
                >
                  <Camera className="w-4 h-4 text-primary-foreground" />
                </button>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {editingName ? (
              <div className="flex items-center gap-2 w-full max-w-[200px]">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="text-center"
                />
                <Button size="sm" onClick={handleUpdateName} disabled={loading}>
                  Save
                </Button>
              </div>
            ) : (
              <button
                onClick={() => isAdmin && setEditingName(true)}
                className="text-lg font-semibold hover:text-primary transition-colors"
              >
                {groupName}
              </button>
            )}
          </div>

          {/* Disappearing Messages */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="w-4 h-4" />
              Disappearing Messages
            </div>
            <Select value={timer} onValueChange={handleTimerChange} disabled={!isAdmin}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="168">7 days</SelectItem>
                <SelectItem value="720">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Members */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{members.length} Members</span>
              {isAdmin && (
                <Button variant="ghost" size="sm">
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {members.map((member) => (
                <div key={member.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={member.profile.avatar_url || undefined} />
                    <AvatarFallback>
                      {member.profile.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium truncate">{member.profile.username}</span>
                      {member.is_admin && (
                        <Crown className="w-3 h-3 text-amber-500" />
                      )}
                    </div>
                  </div>
                  {isAdmin && member.user_id !== user?.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleAdmin(member.user_id, member.is_admin)}
                      >
                        <Crown className={member.is_admin ? 'w-4 h-4 text-amber-500' : 'w-4 h-4 text-muted-foreground'} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemoveMember(member.user_id)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Leave Group */}
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLeaveGroup}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Leave Group
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}