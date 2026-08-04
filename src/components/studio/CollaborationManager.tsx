import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Users2, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface CollabPost {
  id: string;
  caption: string | null;
  media_url: string;
  media_type: string;
  created_at: string;
  user_id: string;
  collaborator_id: string | null;
  collaboration_status: string | null;
  partner?: { username: string; avatar_url: string | null } | null;
}

export function CollaborationManager({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CollabPost[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('posts')
        .select('id, caption, media_url, media_type, created_at, user_id, collaborator_id, collaboration_status')
        .or(`user_id.eq.${user.id},collaborator_id.eq.${user.id}`)
        .not('collaborator_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      const rows = (data ?? []) as CollabPost[];
      const partnerIds = Array.from(
        new Set(rows.map((r) => (r.user_id === user.id ? r.collaborator_id : r.user_id)).filter(Boolean) as string[])
      );
      let profiles: Record<string, { username: string; avatar_url: string | null }> = {};
      if (partnerIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', partnerIds);
        profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
      }
      setItems(rows.map((r) => ({ ...r, partner: profiles[(r.user_id === user.id ? r.collaborator_id : r.user_id) as string] ?? null })));
      setLoading(false);
    })();
  }, [user]);

  const respond = async (id: string, status: 'accepted' | 'declined') => {
    const { error } = await supabase.from('posts').update({ collaboration_status: status }).eq('id', id);
    if (error) return toast({ title: 'Could not update invite', description: error.message, variant: 'destructive' });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, collaboration_status: status } : i)));
    toast({ title: status === 'accepted' ? 'Collaboration accepted' : 'Collaboration declined' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h2 className="text-lg font-semibold">Collaboration Manager</h2>
          <p className="text-xs text-muted-foreground">Co-authored posts and pending invites</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Users2 className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No collaborations yet. Tag a collaborator when you create a post.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((i) => {
            const incoming = i.collaborator_id === user?.id && i.collaboration_status === 'pending';
            return (
              <div key={i.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                <button onClick={() => navigate(`/post/${i.id}`)} className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                  {i.media_type === 'video' ? (
                    <video src={i.media_url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={i.media_url} alt="Collaboration post" className="w-full h-full object-cover" loading="lazy" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{i.caption || 'Untitled post'}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    with @{i.partner?.username ?? 'unknown'} · {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}
                  </p>
                </div>
                {incoming ? (
                  <div className="flex gap-1">
                    <Button size="icon" className="h-8 w-8" onClick={() => respond(i.id, 'accepted')}><Check className="w-4 h-4" /></Button>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => respond(i.id, 'declined')}><X className="w-4 h-4" /></Button>
                  </div>
                ) : (
                  <Badge variant={i.collaboration_status === 'accepted' ? 'default' : 'secondary'} className="capitalize">
                    {i.collaboration_status ?? 'pending'}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
