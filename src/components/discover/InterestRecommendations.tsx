import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';

interface Rec {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  reason: string;
}

export function InterestRecommendations() {
  const { user } = useAuth();
  const [interests, setInterests] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<Rec[] | null>(null);

  if (!user) return null;

  const run = async () => {
    if (interests.trim().length < 3 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('recommend-profiles', {
        body: { interests },
      });
      if (fnError) {
        let msg = 'Could not get recommendations.';
        try {
          const body = await (fnError as { context?: Response }).context?.json();
          if (body?.error) msg = body.error;
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setRecs(data?.recommendations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get recommendations.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-border/60 bg-card/60 p-4">
      <h2 className="font-semibold text-lg flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        Find people by interest
      </h2>
      <p className="text-sm text-muted-foreground mt-1 mb-3">
        Describe what you love and we'll suggest public creators and profiles to follow.
      </p>
      <Textarea
        value={interests}
        onChange={(e) => setInterests(e.target.value)}
        placeholder="e.g. street photography, indie music, cooking South Indian food"
        maxLength={500}
        rows={2}
      />
      <div className="flex justify-end mt-2">
        <Button variant="gradient" size="sm" onClick={run} disabled={loading || interests.trim().length < 3}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
          {loading ? 'Finding…' : 'Recommend'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mt-3">{error}</p>}

      {recs && !error && (
        <div className="mt-4 space-y-2">
          {recs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching profiles yet — try different interests.</p>
          ) : (
            recs.map((r) => (
              <Link
                key={r.id}
                to={`/profile/${r.username}`}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary transition-colors"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage src={r.avatar_url || undefined} />
                  <AvatarFallback>{r.username.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate flex items-center gap-1">
                    {r.username} {r.is_verified && <VerifiedBadge size="sm" />}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.reason || r.full_name}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </section>
  );
}
