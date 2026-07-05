import { useState, useEffect, useRef } from 'react';
import { Settings, Camera, UserPlus, UserMinus, Crown, LogOut, Clock, Loader2, Search, X, Pencil, Info, Shield, MessageSquareOff, BellOff, Bell, Copy, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface GroupMember {
  user_id: string;
  is_admin: boolean;
  joined_at?: string;
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
  const [editingInfo, setEditingInfo] = useState(false);
  const [newName, setNewName] = useState(groupName);
  const [description, setDescription] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [createdBy, setCreatedBy] = useState<string | null>(null);
  const [onlyAdminsMessage, setOnlyAdminsMessage] = useState(false);
  const [onlyAdminsEdit, setOnlyAdminsEdit] = useState(false);
  const [timer, setTimer] = useState(disappearingTimer?.toString() || 'off');
  const [muted, setMuted] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState<Array<{ id: string; username: string; avatar_url: string | null }>>([]);
  const [addSelected, setAddSelected] = useState<Array<{ id: string; username: string; avatar_url: string | null }>>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<GroupMember | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState(false);

  const canEditInfo = isAdmin || !onlyAdminsEdit;

  useEffect(() => {
    if (open) {
      fetchGroupInfo();
      fetchMembers();
      setMuted(localStorage.getItem(`group-muted-${conversationId}`) === '1');
    }
  }, [open, conversationId]);

  useEffect(() => {
    setNewName(groupName);
  }, [groupName]);

  const fetchGroupInfo = async () => {
    const { data } = await (supabase as any)
      .from('conversations')
      .select('group_description, only_admins_can_message, only_admins_can_edit_info, created_at, created_by')
      .eq('id', conversationId)
      .maybeSingle();
    if (data) {
      setDescription(data.group_description || '');
      setNewDescription(data.group_description || '');
      setOnlyAdminsMessage(!!data.only_admins_can_message);
      setOnlyAdminsEdit(!!data.only_admins_can_edit_info);
      setCreatedAt(data.created_at || null);
      setCreatedBy(data.created_by || null);
    }
  };

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('conversation_participants')
      .select('user_id, is_admin, joined_at')
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
        })).sort((a, b) => {
          if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1;
          return a.profile.username.localeCompare(b.profile.username);
        })
      );
    }
  };

  const handleSaveInfo = async () => {
    if (!newName.trim()) {
      toast.error('Group name is required');
      return;
    }
    setLoading(true);
    try {
      await (supabase as any)
        .from('conversations')
        .update({ group_name: newName.trim(), group_description: newDescription.trim() || null })
        .eq('id', conversationId);
      setDescription(newDescription.trim());
      setEditingInfo(false);
      onUpdate();
      toast.success('Group info updated');
    } catch {
      toast.error('Failed to update group info');
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
      const { error } = await supabase.storage.from('media').upload(`groups/${fileName}`, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(`groups/${fileName}`);
      await (supabase as any).from('conversations').update({ group_avatar_url: publicUrl }).eq('id', conversationId);
      onUpdate();
      toast.success('Group photo updated');
    } catch {
      toast.error('Failed to update photo');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setLoading(true);
    try {
      await (supabase as any).from('conversations').update({ group_avatar_url: null }).eq('id', conversationId);
      onUpdate();
      toast.success('Group photo removed');
    } catch {
      toast.error('Failed to remove photo');
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
      toast.success(currentlyAdmin ? 'Dismissed as admin' : 'Made group admin');
    } catch {
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
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setConfirmRemove(null);
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
      toast.success(timerValue ? `Messages disappear after ${timerValue}h` : 'Disappearing messages off');
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleTogglePermission = async (field: 'only_admins_can_message' | 'only_admins_can_edit_info', value: boolean) => {
    try {
      await (supabase as any).from('conversations').update({ [field]: value }).eq('id', conversationId);
      if (field === 'only_admins_can_message') setOnlyAdminsMessage(value);
      else setOnlyAdminsEdit(value);
      toast.success('Permission updated');
    } catch {
      toast.error('Failed to update permission');
    }
  };

  const handleToggleMute = (value: boolean) => {
    setMuted(value);
    localStorage.setItem(`group-muted-${conversationId}`, value ? '1' : '0');
    toast.success(value ? 'Notifications muted' : 'Notifications unmuted');
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
      toast.success('You left the group');
    } catch {
      toast.error('Failed to leave group');
    } finally {
      setConfirmLeave(false);
    }
  };

  const handleClearChat = async () => {
    if (!user) return;
    try {
      await (supabase as any)
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
      toast.success('Chat cleared for you');
    } catch {
      toast.error('Failed to clear chat');
    } finally {
      setConfirmClear(false);
    }
  };

  const handleCopyInviteLink = () => {
    const link = `${window.location.origin}/messages/${conversationId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success('Group link copied');
  };

  useEffect(() => {
    if (!showAddMembers) return;
    if (addSearch.trim().length < 2) {
      setAddResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const memberIds = members.map(m => m.user_id);
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${addSearch.trim()}%`)
        .limit(15);
      setAddResults((data || []).filter(p => !memberIds.includes(p.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [addSearch, showAddMembers, members]);

  const handleAddMembers = async () => {
    if (addSelected.length === 0) return;
    setAddLoading(true);
    try {
      const { error } = await supabase.from('conversation_participants').insert(
        addSelected.map(u => ({ conversation_id: conversationId, user_id: u.id }))
      );
      if (error) throw error;
      toast.success(`Added ${addSelected.length} member${addSelected.length > 1 ? 's' : ''}`);
      setAddSelected([]);
      setAddSearch('');
      setAddResults([]);
      setShowAddMembers(false);
      fetchMembers();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add members');
    } finally {
      setAddLoading(false);
    }
  };

  const filteredMembers = members.filter(m =>
    m.profile.username.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const creatorName = createdBy ? members.find(m => m.user_id === createdBy)?.profile.username : null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="w-5 h-5" />
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md overflow-y-auto backdrop-blur-xl">
        <SheetHeader>
          <SheetTitle>Group info</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 pb-8">
          {/* Group Avatar & Name */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={groupAvatarUrl || undefined} />
                <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                  {groupName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {canEditInfo && (
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={loading}
                  className="absolute -bottom-1 -right-1 w-9 h-9 bg-primary rounded-full flex items-center justify-center border-2 border-background shadow-md"
                  aria-label="Change group photo"
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
            {canEditInfo && groupAvatarUrl && (
              <button onClick={handleRemoveAvatar} className="text-xs text-muted-foreground hover:text-destructive">
                Remove photo
              </button>
            )}

            <div className="w-full">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-xl font-semibold">{groupName}</h2>
                {canEditInfo && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingInfo(true)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Group · {members.length} member{members.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="rounded-xl border bg-card/50 backdrop-blur p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">
                  {description || <span className="text-muted-foreground italic">Add a group description…</span>}
                </p>
                {createdAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {creatorName ? `by ${creatorName} ` : ''}on {format(new Date(createdAt), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Invite link */}
          <button
            onClick={handleCopyInviteLink}
            className="w-full flex items-center gap-3 p-3 rounded-xl border bg-card/50 backdrop-blur hover:bg-muted/60 transition-colors text-left"
          >
            {copied ? <Check className="w-5 h-5 text-primary" /> : <Copy className="w-5 h-5 text-primary" />}
            <div className="flex-1">
              <p className="text-sm font-medium">Copy group link</p>
              <p className="text-xs text-muted-foreground">Share this chat with others</p>
            </div>
          </button>

          {/* Notifications & Disappearing */}
          <div className="rounded-xl border bg-card/50 backdrop-blur divide-y">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                {muted ? <BellOff className="w-4 h-4 text-muted-foreground" /> : <Bell className="w-4 h-4 text-muted-foreground" />}
                <div>
                  <Label className="text-sm">Mute notifications</Label>
                  <p className="text-xs text-muted-foreground">Silence alerts from this group</p>
                </div>
              </div>
              <Switch checked={muted} onCheckedChange={handleToggleMute} />
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Label>Disappearing messages</Label>
              </div>
              <Select value={timer} onValueChange={handleTimerChange} disabled={!isAdmin}>
                <SelectTrigger>
                  <SelectValue placeholder="Off" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                  <SelectItem value="168">7 days</SelectItem>
                  <SelectItem value="720">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Group Permissions (admins only) */}
          {isAdmin && (
            <div className="rounded-xl border bg-card/50 backdrop-blur">
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Group permissions</p>
              </div>
              <div className="divide-y">
                <div className="flex items-center justify-between p-3">
                  <div>
                    <Label className="text-sm">Only admins can edit info</Label>
                    <p className="text-xs text-muted-foreground">Name, photo, and description</p>
                  </div>
                  <Switch checked={onlyAdminsEdit} onCheckedChange={(v) => handleTogglePermission('only_admins_can_edit_info', v)} />
                </div>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <MessageSquareOff className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm">Only admins can message</Label>
                      <p className="text-xs text-muted-foreground">Restrict who can send messages</p>
                    </div>
                  </div>
                  <Switch checked={onlyAdminsMessage} onCheckedChange={(v) => handleTogglePermission('only_admins_can_message', v)} />
                </div>
              </div>
            </div>
          )}

          {/* Members */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{members.length} members</span>
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => setShowAddMembers(true)}>
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add member
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="space-y-1 max-h-[280px] overflow-y-auto rounded-xl border bg-card/50 backdrop-blur p-1">
              {filteredMembers.map((member) => (
                <div key={member.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={member.profile.avatar_url || undefined} />
                    <AvatarFallback>
                      {member.profile.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">
                        {member.user_id === user?.id ? 'You' : member.profile.username}
                      </span>
                      {member.is_admin && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5" /> Admin
                        </span>
                      )}
                    </div>
                    {member.user_id !== user?.id && (
                      <p className="text-xs text-muted-foreground truncate">@{member.profile.username}</p>
                    )}
                  </div>
                  {isAdmin && member.user_id !== user?.id && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={member.is_admin ? 'Dismiss as admin' : 'Make admin'}
                        onClick={() => handleToggleAdmin(member.user_id, member.is_admin)}
                      >
                        <Crown className={member.is_admin ? 'w-4 h-4 text-amber-500' : 'w-4 h-4 text-muted-foreground'} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Remove from group"
                        onClick={() => setConfirmRemove(member)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {filteredMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No members found</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Danger zone */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear chat
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={() => setConfirmLeave(true)}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Exit group
            </Button>
          </div>
        </div>
      </SheetContent>

      {/* Edit info dialog */}
      <Dialog open={editingInfo} onOpenChange={setEditingInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit group info</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, 60))}
                maxLength={60}
                placeholder="Group name"
              />
              <p className="text-xs text-muted-foreground text-right">{newName.length}/60</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="group-desc">Description</Label>
              <Textarea
                id="group-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value.slice(0, 300))}
                maxLength={300}
                rows={4}
                placeholder="Add a description so members know what this group is about"
              />
              <p className="text-xs text-muted-foreground text-right">{newDescription.length}/300</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditingInfo(false); setNewName(groupName); setNewDescription(description); }}>Cancel</Button>
            <Button onClick={handleSaveInfo} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add members dialog */}
      <Dialog open={showAddMembers} onOpenChange={(o) => { setShowAddMembers(o); if (!o) { setAddSearch(''); setAddResults([]); setAddSelected([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add members</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search by username"
                value={addSearch}
                onChange={(e) => setAddSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {addSelected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {addSelected.map(u => (
                  <button
                    key={u.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs"
                    onClick={() => setAddSelected(s => s.filter(x => x.id !== u.id))}
                  >
                    {u.username}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {addResults.map(u => {
                const picked = !!addSelected.find(s => s.id === u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => setAddSelected(s => picked ? s.filter(x => x.id !== u.id) : [...s, u])}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${picked ? 'bg-primary/10' : 'hover:bg-muted'}`}
                  >
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback>{u.username.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm flex-1">{u.username}</span>
                    {picked && <span className="text-xs text-primary">Selected</span>}
                  </button>
                );
              })}
              {addSearch.trim().length >= 2 && addResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
              )}
              {addSearch.trim().length < 2 && (
                <p className="text-sm text-muted-foreground text-center py-4">Type at least 2 characters</p>
              )}
            </div>
            <Button className="w-full" disabled={addSelected.length === 0 || addLoading} onClick={handleAddMembers}>
              {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Add ${addSelected.length || ''} member${addSelected.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm remove */}
      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmRemove?.profile.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to send messages to this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRemove && handleRemoveMember(confirmRemove.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm leave */}
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Exit "{groupName}"?</AlertDialogTitle>
            <AlertDialogDescription>
              You will stop receiving messages from this group. Only group admins can add you back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Exit group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm clear */}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Older messages will be hidden from your view. Other members will still see them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearChat}>Clear chat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
