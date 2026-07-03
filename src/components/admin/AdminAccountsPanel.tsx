import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, Loader2, Ban, ShieldOff, CheckCircle2, PauseCircle, MoreVertical, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UserRow {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  account_status: string;
  moderation_reason: string | null;
  moderated_at: string | null;
  suspended_until: string | null;
  created_at: string;
}

type StatusFilter = 'all' | 'active' | 'suspended' | 'banned';

const statusMeta: Record<string, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  suspended: { label: 'Suspended', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  banned: { label: 'Banned', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function AdminAccountsPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [pending, setPending] = useState<{ user: UserRow; action: 'ban' | 'suspend' | 'reactivate' } | null>(null);
  const [reason, setReason] = useState('');
  const [suspendDays, setSuspendDays] = useState('7');
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('id, username, full_name, avatar_url, account_status, moderation_reason, moderated_at, suspended_until, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      toast.error('Failed to load accounts');
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter(u => {
    if (filter !== 'all' && (u.account_status || 'active') !== filter) return false;
    const t = query.toLowerCase().trim();
    if (!t) return true;
    return u.username?.toLowerCase().includes(t) || u.full_name?.toLowerCase().includes(t);
  });

  const openAction = (u: UserRow, action: 'ban' | 'suspend' | 'reactivate') => {
    setPending({ user: u, action });
    setReason(u.moderation_reason || '');
    setSuspendDays('7');
  };

  const applyAction = async () => {
    if (!pending || !user) return;
    setSaving(true);
    const now = new Date().toISOString();
    let update: any = {
      moderated_by: user.id,
      moderated_at: now,
    };
    if (pending.action === 'ban') {
      update.account_status = 'banned';
      update.moderation_reason = reason || null;
      update.suspended_until = null;
    } else if (pending.action === 'suspend') {
      const days = Math.max(1, parseInt(suspendDays) || 7);
      update.account_status = 'suspended';
      update.moderation_reason = reason || null;
      update.suspended_until = new Date(Date.now() + days * 86400000).toISOString();
    } else {
      update.account_status = 'active';
      update.moderation_reason = null;
      update.suspended_until = null;
    }
    const { error } = await (supabase as any)
      .from('profiles')
      .update(update)
      .eq('id', pending.user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Action failed');
      return;
    }
    toast.success(
      pending.action === 'ban' ? 'Account banned'
      : pending.action === 'suspend' ? 'Account suspended'
      : 'Account reactivated'
    );
    setPending(null);
    fetchUsers();
  };

  const counts = {
    all: users.length,
    active: users.filter(u => (u.account_status || 'active') === 'active').length,
    suspended: users.filter(u => u.account_status === 'suspended').length,
    banned: users.filter(u => u.account_status === 'banned').length,
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-3xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
            <UserX className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg leading-tight">Account lifecycle</h2>
            <p className="text-xs text-muted-foreground">Suspend, ban, or reactivate accounts</p>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 rounded-full bg-secondary/60 border-0"
          />
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList className="grid grid-cols-4 w-full h-9 bg-secondary/60 rounded-full p-1">
            <TabsTrigger value="all" className="rounded-full text-xs">All · {counts.all}</TabsTrigger>
            <TabsTrigger value="active" className="rounded-full text-xs">Active · {counts.active}</TabsTrigger>
            <TabsTrigger value="suspended" className="rounded-full text-xs">Suspended · {counts.suspended}</TabsTrigger>
            <TabsTrigger value="banned" className="rounded-full text-xs">Banned · {counts.banned}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-3 flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">No accounts match your filters.</div>
        ) : (
          filtered.map(u => {
            const status = (u.account_status || 'active') as keyof typeof statusMeta;
            const meta = statusMeta[status];
            return (
              <div key={u.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {u.username?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">@{u.username}</span>
                    <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {u.full_name || '—'}
                    {u.suspended_until && status === 'suspended' && (
                      <> · until {format(new Date(u.suspended_until), 'MMM d, yyyy')}</>
                    )}
                    {u.moderation_reason && <> · {u.moderation_reason}</>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {status !== 'active' && (
                      <DropdownMenuItem onClick={() => openAction(u, 'reactivate')}>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> Reactivate
                      </DropdownMenuItem>
                    )}
                    {status !== 'suspended' && (
                      <DropdownMenuItem onClick={() => openAction(u, 'suspend')}>
                        <PauseCircle className="h-4 w-4 mr-2 text-amber-600" /> Suspend
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {status !== 'banned' && (
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openAction(u, 'ban')}>
                        <Ban className="h-4 w-4 mr-2" /> Ban user
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.action === 'ban' && <>Ban @{pending.user.username}?</>}
              {pending?.action === 'suspend' && <>Suspend @{pending?.user.username}?</>}
              {pending?.action === 'reactivate' && <>Reactivate @{pending?.user.username}?</>}
            </DialogTitle>
            <DialogDescription>
              {pending?.action === 'ban' && 'This permanently disables the account. Enter a reason for the audit log.'}
              {pending?.action === 'suspend' && 'Temporarily restricts the account for the number of days you set.'}
              {pending?.action === 'reactivate' && 'Restores full access to this account.'}
            </DialogDescription>
          </DialogHeader>

          {pending?.action !== 'reactivate' && (
            <div className="space-y-3">
              {pending?.action === 'suspend' && (
                <div>
                  <Label className="text-xs">Duration (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={suspendDays}
                    onChange={(e) => setSuspendDays(e.target.value)}
                  />
                </div>
              )}
              <div>
                <Label className="text-xs">Reason (visible to admins)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Repeated harassment reports"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            <Button
              onClick={applyAction}
              disabled={saving}
              className={pending?.action === 'ban' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              variant={pending?.action === 'reactivate' ? 'gradient' : 'default'}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {pending?.action === 'ban' && <><Ban className="h-4 w-4 mr-2" />Ban account</>}
              {pending?.action === 'suspend' && <><PauseCircle className="h-4 w-4 mr-2" />Suspend</>}
              {pending?.action === 'reactivate' && <><ShieldOff className="h-4 w-4 mr-2" />Reactivate</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
