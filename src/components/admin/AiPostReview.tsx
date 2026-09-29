import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type Review = {
  verdict: string;
  severity: string;
  violations?: { category: string; confidence: number; evidence: string }[];
  summary: string;
  suggested_action: string;
};

export function AiPostReview({ postId, reason }: { postId?: string | null; reason?: string }) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState('');

  const onOpen = async (v: boolean) => {
    setOpen(v);
    if (v && postId && !caption && !imageUrl) {
      const { data } = await supabase.from('posts').select('caption, media_url, media_type').eq('id', postId).maybeSingle();
      if (data) {
        setCaption(data.caption ?? '');
        if (data.media_type === 'image' && data.media_url) setImageUrl(data.media_url.split(',')[0]);
      }
    }
  };

  const run = async () => {
    setLoading(true); setError(''); setReview(null);
    const { data, error } = await supabase.functions.invoke('review-post', { body: { caption, image_url: imageUrl, reason } });
    setLoading(false);
    const msg = (data as any)?.error || (error ? (await (error as any).context?.json?.().catch(() => null))?.error || 'Couldn’t review this post.' : '');
    if (msg) { setError(msg); return; }
    setReview((data as any).review);
  };

  const tone = review?.verdict === 'likely_violation' ? 'destructive' : review?.verdict === 'possible_violation' ? 'secondary' : 'outline';

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Sparkles className="w-3.5 h-3.5 mr-1" /> AI review</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>AI policy review</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Caption</label>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Post caption" className="min-h-[80px]" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Image link</label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            {imageUrl && <img src={imageUrl} alt="Reported post" className="mt-2 max-h-48 rounded-lg object-contain" />}
          </div>
          <Button onClick={run} disabled={loading || (!caption.trim() && !imageUrl.trim())} className="w-full">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reviewing…</> : 'Run review'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {review && (
            <div className="space-y-2 rounded-xl bg-secondary/40 p-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={tone as any}>{review.verdict?.replace(/_/g, ' ')}</Badge>
                <Badge variant="outline">severity: {review.severity}</Badge>
                <Badge variant="outline">suggested: {review.suggested_action}</Badge>
              </div>
              <p className="text-sm">{review.summary}</p>
              {!!review.violations?.length && (
                <ul className="space-y-1 text-xs">
                  {review.violations.filter(v => v.category !== 'none').map((v, i) => (
                    <li key={i}><span className="font-medium">{v.category.replace(/_/g, ' ')}</span> ({Math.round((v.confidence ?? 0) * 100)}%) — {v.evidence}</li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground">AI suggestions can be wrong — make the final call yourself.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
