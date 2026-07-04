import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface MemoryItem {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  created_at: string;
  yearsAgo: number;
  source: 'post' | 'story';
}

export function MemoriesCard() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const mm = today.getMonth();
    const dd = today.getDate();
    const yyyy = today.getFullYear();

    // Check if user already dismissed today
    const dismissKey = `memories-dismissed-${yyyy}-${mm + 1}-${dd}`;
    if (localStorage.getItem(dismissKey) === '1') {
      setDismissed(true);
      return;
    }

    const load = async () => {
      const [{ data: posts }, { data: stories }] = await Promise.all([
        supabase
          .from('posts')
          .select('id, media_url, media_type, caption, created_at')
          .eq('user_id', user.id)
          .lt('created_at', new Date(yyyy, mm, dd).toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('stories')
          .select('id, media_url, media_type, created_at')
          .eq('user_id', user.id)
          .lt('created_at', new Date(yyyy, mm, dd).toISOString())
          .order('created_at', { ascending: false }),
      ]);

      const matches: MemoryItem[] = [];
      posts?.forEach((p: any) => {
        const d = new Date(p.created_at);
        if (d.getMonth() === mm && d.getDate() === dd) {
          matches.push({
            id: p.id,
            media_url: p.media_url,
            media_type: p.media_type,
            caption: p.caption,
            created_at: p.created_at,
            yearsAgo: yyyy - d.getFullYear(),
            source: 'post',
          });
        }
      });
      stories?.forEach((s: any) => {
        const d = new Date(s.created_at);
        if (d.getMonth() === mm && d.getDate() === dd) {
          matches.push({
            id: s.id,
            media_url: s.media_url,
            media_type: s.media_type,
            caption: null,
            created_at: s.created_at,
            yearsAgo: yyyy - d.getFullYear(),
            source: 'story',
          });
        }
      });

      matches.sort((a, b) => a.yearsAgo - b.yearsAgo);
      setMemories(matches);
    };
    load();
  }, [user]);

  const dismiss = () => {
    const today = new Date();
    localStorage.setItem(
      `memories-dismissed-${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`,
      '1'
    );
    setDismissed(true);
  };

  if (!user || dismissed || memories.length === 0) return null;

  const active = viewerIndex !== null ? memories[viewerIndex] : null;

  return (
    <>
      <div className="mx-3 mt-3 mb-2 rounded-3xl overflow-hidden border border-border/60 bg-card/60 backdrop-blur-xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl gradient-primary flex items-center justify-center shadow-md">
              <Sparkles className="w-4 h-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">On this day</h2>
              <p className="text-xs text-muted-foreground">
                {memories.length} {memories.length === 1 ? 'memory' : 'memories'} from your past
              </p>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss memories"
            className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto hide-scrollbar px-3 pb-3">
          {memories.map((m, i) => (
            <button
              key={`${m.source}-${m.id}`}
              onClick={() => setViewerIndex(i)}
              className="relative flex-shrink-0 w-28 h-40 rounded-2xl overflow-hidden ring-1 ring-border/60 hover:ring-primary/60 transition-all group"
              aria-label={`Memory from ${m.yearsAgo} ${m.yearsAgo === 1 ? 'year' : 'years'} ago`}
            >
              {m.media_type === 'image' ? (
                <img
                  src={m.media_url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <video src={m.media_url} className="w-full h-full object-cover" muted />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/90 block">
                  {m.yearsAgo}y ago
                </span>
                <span className={cn(
                  "text-[9px] font-medium uppercase tracking-wider",
                  m.source === 'post' ? 'text-primary-foreground/80' : 'text-white/70'
                )}>
                  {m.source}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {active && viewerIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center"
          onClick={() => setViewerIndex(null)}
        >
          <button
            onClick={() => setViewerIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          {viewerIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex - 1); }}
              className="absolute left-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white z-10"
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {viewerIndex < memories.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setViewerIndex(viewerIndex + 1); }}
              className="absolute right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white z-10"
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          <div
            className="relative max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-3xl overflow-hidden bg-card">
              {active.media_type === 'image' ? (
                <img src={active.media_url} alt="" className="w-full max-h-[70vh] object-contain bg-black" />
              ) : (
                <video src={active.media_url} controls autoPlay className="w-full max-h-[70vh] bg-black" />
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">
                    {active.yearsAgo} {active.yearsAgo === 1 ? 'year' : 'years'} ago
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(active.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                {active.caption && (
                  <p className="text-sm text-foreground/90 mb-3">{active.caption}</p>
                )}
                {active.source === 'post' && (
                  <Link
                    to={`/post/${active.id}`}
                    className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                    onClick={() => setViewerIndex(null)}
                  >
                    View original post →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
