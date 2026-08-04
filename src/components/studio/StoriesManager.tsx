import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, Clock, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface StoryRow {
  id: string;
  media_url: string;
  media_type: string;
  visibility: string;
  created_at: string;
  expires_at: string;
  views: number;
}

export function StoriesManager({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<StoryRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('stories')
        .select('id, media_url, media_type, visibility, created_at, expires_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60);

      const rows = data ?? [];
      const withViews = await Promise.all(
        rows.map(async (s) => {
          const { count } = await supabase
            .from('story_views')
            .select('id', { count: 'exact', head: true })
            .eq('story_id', s.id);
          return { ...s, views: count ?? 0 } as StoryRow;
        })
      );
      setStories(withViews);
      setLoading(false);
    })();
  }, [user]);

  const remove = async (id: string) => {
    const { error } = await supabase.from('stories').delete().eq('id', id);
    if (error) return toast({ title: 'Could not delete story', description: error.message, variant: 'destructive' });
    setStories((prev) => prev.filter((s) => s.id !== id));
    toast({ title: 'Story deleted' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h2 className="text-lg font-semibold">Stories Manager</h2>
          <p className="text-xs text-muted-foreground">Active and recent stories with view counts</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : stories.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">You haven't posted any stories yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {stories.map((s) => {
            const live = new Date(s.expires_at) > new Date();
            return (
              <div key={s.id} className="rounded-xl overflow-hidden border bg-card">
                <div className="relative aspect-[9/16] bg-muted">
                  {s.media_type === 'video' ? (
                    <video src={s.media_url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={s.media_url} alt="Story preview" className="w-full h-full object-cover" loading="lazy" />
                  )}
                  <Badge className="absolute top-2 left-2" variant={live ? 'default' : 'secondary'}>
                    {live ? 'Live' : 'Expired'}
                  </Badge>
                </div>
                <div className="p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{s.views}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] capitalize text-muted-foreground">{s.visibility.replace('_', ' ')}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(s.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
