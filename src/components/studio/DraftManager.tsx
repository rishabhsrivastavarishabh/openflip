import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Trash2, Pencil, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface DraftRow {
  id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  location: string | null;
  updated_at: string;
}

export function DraftManager({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('drafts')
        .select('id, caption, media_url, media_type, location, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      setDrafts(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const remove = async (id: string) => {
    const { error } = await supabase.from('drafts').delete().eq('id', id);
    if (error) return toast({ title: 'Could not delete draft', description: error.message, variant: 'destructive' });
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    toast({ title: 'Draft deleted' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h2 className="text-lg font-semibold">Draft Manager</h2>
          <p className="text-xs text-muted-foreground">Unpublished work saved from the composer</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No drafts saved yet.</p>
          <Button onClick={() => navigate('/create')}>Start creating</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map((d) => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
              <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                {d.media_url && d.media_type === 'video' ? (
                  <video src={d.media_url} className="w-full h-full object-cover" muted playsInline />
                ) : d.media_url ? (
                  <img src={d.media_url} alt="Draft preview" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><FileText className="w-5 h-5 text-muted-foreground" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{d.caption || 'Untitled draft'}</p>
                <p className="text-xs text-muted-foreground">
                  Edited {formatDistanceToNow(new Date(d.updated_at), { addSuffix: true })}
                  {d.location ? ` · ${d.location}` : ''}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => navigate(`/create?draft=${d.id}`)}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
