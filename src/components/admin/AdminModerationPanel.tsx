import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Megaphone, Crown, Wallet } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type Row = Record<string, any> & { _requester?: Profile | null; _secondary?: Profile | null };

const LIMIT = 40;

function statusVariant(status?: string) {
  const s = (status || '').toLowerCase();
  if (['active', 'approved', 'completed', 'paid'].includes(s)) return 'default';
  if (['pending', 'pending_review', 'draft', 'processing'].includes(s)) return 'secondary';
  if (['cancelled', 'declined', 'failed', 'rejected', 'expired'].includes(s)) return 'destructive';
  return 'outline';
}

function timeAgo(iso?: string | null) {
  if (!iso) return '—';
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return '—'; }
}

function UserChip({ p, fallbackId }: { p?: Profile | null; fallbackId?: string }) {
  const label = p?.username || p?.full_name || (fallbackId ? fallbackId.slice(0, 8) : 'unknown');
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar className="w-7 h-7 shrink-0">
        <AvatarImage src={p?.avatar_url ?? undefined} />
        <AvatarFallback>{(label[0] || '?').toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">@{label}</div>
        {p?.full_name && p?.username && (
          <div className="text-[11px] text-muted-foreground truncate">{p.full_name}</div>
        )}
      </div>
    </div>
  );
}

async function attachProfiles(rows: any[], keys: string[]): Promise<Row[]> {
  const ids = Array.from(new Set(rows.flatMap((r) => keys.map((k) => r[k])).filter(Boolean)));
  if (ids.length === 0) return rows;
  const { data } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', ids);
  const map = new Map<string, Profile>((data ?? []).map((p) => [p.id, p as Profile]));
  return rows.map((r) => ({
    ...r,
    _requester: keys[0] ? map.get(r[keys[0]]) ?? null : null,
    _secondary: keys[1] ? map.get(r[keys[1]]) ?? null : null,
  }));
}

export function AdminModerationPanel() {
  const [tab, setTab] = useState('campaigns');
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Row[]>([]);
  const [subs, setSubs] = useState<Row[]>([]);
  const [payouts, setPayouts] = useState<Row[]>([]);

  const load = async () => {
    setLoading(true);
    const [c, s, p] = await Promise.all([
      supabase.from('boost_campaigns').select('*').order('updated_at', { ascending: false }).limit(LIMIT),
      supabase.from('creator_subscriptions').select('*').order('updated_at', { ascending: false }).limit(LIMIT),
      supabase.from('payout_requests').select('*').order('created_at', { ascending: false }).limit(LIMIT),
    ]);
    setCampaigns(await attachProfiles(c.data ?? [], ['user_id']));
    setSubs(await attachProfiles(s.data ?? [], ['subscriber_id', 'creator_id']));
    setPayouts(await attachProfiles(p.data ?? [], ['user_id']));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Recent activity — moderation</h2>
          <p className="text-xs text-muted-foreground">Latest {LIMIT} records per stream. Newest first.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="campaigns" className="gap-1.5"><Megaphone className="w-3.5 h-3.5" />Campaigns<span className="ml-1 text-[10px] text-muted-foreground">({campaigns.length})</span></TabsTrigger>
          <TabsTrigger value="subs" className="gap-1.5"><Crown className="w-3.5 h-3.5" />Subscriptions<span className="ml-1 text-[10px] text-muted-foreground">({subs.length})</span></TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1.5"><Wallet className="w-3.5 h-3.5" />Payouts<span className="ml-1 text-[10px] text-muted-foreground">({payouts.length})</span></TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-2 mt-3">
          {campaigns.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-6">No boost campaigns yet.</p>
          )}
          {campaigns.map((r) => (
            <div key={r.id} className="glass-card rounded-2xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <UserChip p={r._requester} fallbackId={r.user_id} />
                <Badge variant={statusVariant(r.status) as any}>{r.status}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div><span className="text-muted-foreground">Content:</span> {r.content_type}</div>
                <div><span className="text-muted-foreground">Budget:</span> {r.currency} {r.budget}</div>
                <div><span className="text-muted-foreground">Duration:</span> {r.duration_days}d</div>
                <div><span className="text-muted-foreground">Impressions:</span> {r.impressions ?? 0}</div>
              </div>
              <div className="text-[11px] text-muted-foreground flex justify-between">
                <span>Updated {timeAgo(r.updated_at)}</span>
                <span>Created {timeAgo(r.created_at)}</span>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="subs" className="space-y-2 mt-3">
          {subs.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-6">No creator subscriptions yet.</p>
          )}
          {subs.map((r) => (
            <div key={r.id} className="glass-card rounded-2xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Subscriber</div>
                    <UserChip p={r._requester} fallbackId={r.subscriber_id} />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Creator</div>
                    <UserChip p={r._secondary} fallbackId={r.creator_id} />
                  </div>
                </div>
                <Badge variant={statusVariant(r.status) as any}>{r.status}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div><span className="text-muted-foreground">Tier:</span> {r.tier}</div>
                <div><span className="text-muted-foreground">Amount:</span> {r.currency} {r.amount}</div>
                <div><span className="text-muted-foreground">Cycle:</span> {r.billing_cycle}</div>
                <div><span className="text-muted-foreground">Expires:</span> {r.expires_at ? timeAgo(r.expires_at) : '—'}</div>
              </div>
              <div className="text-[11px] text-muted-foreground flex justify-between">
                <span>Updated {timeAgo(r.updated_at)}</span>
                <span>Started {timeAgo(r.started_at)}</span>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="payouts" className="space-y-2 mt-3">
          {payouts.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-6">No payout requests yet.</p>
          )}
          {payouts.map((r) => (
            <div key={r.id} className="glass-card rounded-2xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <UserChip p={r._requester} fallbackId={r.user_id} />
                <Badge variant={statusVariant(r.status) as any}>{r.status}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div><span className="text-muted-foreground">Amount:</span> {r.currency} {r.amount}</div>
                <div><span className="text-muted-foreground">Method:</span> {r.payment_method || '—'}</div>
                <div><span className="text-muted-foreground">Processed:</span> {r.processed_at ? timeAgo(r.processed_at) : 'not yet'}</div>
              </div>
              <div className="text-[11px] text-muted-foreground flex justify-between">
                <span>Requested {timeAgo(r.created_at)}</span>
                <span>Updated {timeAgo(r.updated_at)}</span>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
