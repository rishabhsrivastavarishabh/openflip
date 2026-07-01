import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Ban } from 'lucide-react';
import { toast } from 'sonner';

export default function PrivacyPage() {
  const { user, profile, updateProfile } = useAuth();
  const [isPrivate, setIsPrivate] = useState(profile?.is_private || false);
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState<any[]>([]);

  useEffect(() => {
    setIsPrivate(profile?.is_private || false);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('blocked_users')
        .select('id, blocked_id, created_at')
        .eq('blocker_id', user.id);
      if (!data) return;
      const ids = data.map((b: any) => b.blocked_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', ids);
      const map = new Map(profiles?.map((p) => [p.id, p]) ?? []);
      setBlocked(data.map((b: any) => ({ ...b, profile: map.get(b.blocked_id) })));
    })();
  }, [user]);

  const toggle = async (checked: boolean) => {
    setIsPrivate(checked);
    setSaving(true);
    const { error } = await updateProfile({ is_private: checked });
    setSaving(false);
    if (error) {
      setIsPrivate(!checked);
      toast.error('Failed to update privacy');
    } else {
      toast.success(checked ? 'Account is now private' : 'Account is now public');
    }
  };

  const unblock = async (id: string) => {
    if (!user) return;
    await (supabase as any).from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', id);
    setBlocked((prev) => prev.filter((b) => b.blocked_id !== id));
    toast.success('User unblocked');
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-1">Privacy</h2>
        <p className="text-sm text-muted-foreground">Control who can find you and see your content.</p>
      </section>

      <section className="border rounded-2xl p-4 flex items-center justify-between">
        <div>
          <Label htmlFor="private-account" className="font-medium">Private account</Label>
          <p className="text-sm text-muted-foreground">Only approved followers can see your posts and reels.</p>
        </div>
        <Switch id="private-account" checked={isPrivate} onCheckedChange={toggle} disabled={saving} />
      </section>

      <section className="border rounded-2xl p-4">
        <h3 className="font-semibold mb-3">Blocked users</h3>
        {blocked.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Ban className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-sm">You haven't blocked anyone.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {blocked.map((b) => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={b.profile?.avatar_url} />
                    <AvatarFallback>{b.profile?.username?.charAt(0).toUpperCase() ?? '?'}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{b.profile?.username ?? 'Unknown'}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => unblock(b.blocked_id)}>Unblock</Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
