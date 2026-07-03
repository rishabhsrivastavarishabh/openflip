import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, UserPlus, Check, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { toast } from 'sonner';

interface Suggestion {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  follower_count: number;
}

export function OnboardingSuggestions() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<Suggestion[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && profile.onboarding_completed === false) {
        setOpen(true);
        await load();
      }
    })();
  }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_verified')
      .neq('id', user.id)
      .limit(20);

    if (data) {
      const withCounts = await Promise.all(
        data.map(async (p: any) => {
          const { count } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', p.id);
          return { ...p, follower_count: count || 0 };
        })
      );
      withCounts.sort((a, b) => (b.is_verified ? 1 : 0) - (a.is_verified ? 1 : 0) || b.follower_count - a.follower_count);
      setUsers(withCounts);
    }
    setLoading(false);
  };

  const toggle = async (id: string) => {
    if (!user) return;
    const isFollowing = following.has(id);
    setFollowing(prev => {
      const s = new Set(prev);
      if (isFollowing) s.delete(id); else s.add(id);
      return s;
    });
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', id);
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: id });
      await supabase.from('notifications').insert({ user_id: id, actor_id: user.id, type: 'follow' });
    }
  };

  const finish = async () => {
    if (!user) return;
    setSaving(true);
    await (supabase as any)
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);
    setSaving(false);
    setOpen(false);
    if (following.size > 0) {
      toast.success(`Following ${following.size} ${following.size === 1 ? 'account' : 'accounts'}!`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && finish()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center mb-2 shadow-glow">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-xl">Welcome! Find people to follow</DialogTitle>
          <DialogDescription>
            Follow a few accounts to fill up your feed. You can always find more later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-2">
              {users.map(u => {
                const isFollowing = following.has(u.id);
                return (
                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/40 transition-colors">
                    <Avatar className="w-11 h-11">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">{u.username.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="font-medium text-sm truncate">{u.username}</p>
                        {u.is_verified && <VerifiedBadge className="w-3.5 h-3.5" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.full_name || `${u.follower_count} followers`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={isFollowing ? 'secondary' : 'gradient'}
                      onClick={() => toggle(u.id)}
                    >
                      {isFollowing ? (
                        <><Check className="w-3.5 h-3.5 mr-1" /> Following</>
                      ) : (
                        <><UserPlus className="w-3.5 h-3.5 mr-1" /> Follow</>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button variant="ghost" className="flex-1" onClick={finish} disabled={saving}>
            Skip
          </Button>
          <Button variant="gradient" className="flex-1" onClick={finish} disabled={saving}>
            {saving ? 'Saving...' : following.size > 0 ? `Done · ${following.size}` : 'Done'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
