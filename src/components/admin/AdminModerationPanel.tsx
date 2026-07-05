import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RefreshCw, Megaphone, Crown, Wallet, CheckCircle2, AlertTriangle, ShieldOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type EntityType = 'campaign' | 'subscription' | 'payout';

type Review = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  action: 'reviewed' | 'investigate';
  note: string | null;
  reviewed_by: string;
  reviewed_at: string;
  _reviewer?: Profile | null;
};

type Row = Record<string, any> & {
  _requester?: Profile | null;
  _secondary?: Profile | null;
  _review?: Review | null;
};

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

async function fetchProfiles(ids: string[]): Promise<Map<string, Profile>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', unique);
  return new Map<string, Profile>((data ?? []).map((p) => [p.id, p as Profile]));
}

function ReviewBadge({ r }: { r: Review }) {
  const isInvestigate = r.action === 'investigate';
  const Icon = isInvestigate ? AlertTriangle : CheckCircle2;
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${isInvestigate ? 'border-destructive/40 bg-destructive/5' : 'border-primary/30 bg-primary/5'}`}>
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isInvestigate ? 'text-destructive' : 'text-primary'}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium">
            {isInvestigate ? 'Investigation requested' : 'Marked reviewed'}
          </span>
          <span className="text-muted-foreground">
            by @{r._reviewer?.username || r.reviewed_by.slice(0, 8)} · {timeAgo(r.reviewed_at)}
          </span>
        </div>
        {r.note && <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">{r.note}</p>}
      </div>
    </div>
  );
}

export function AdminModerationPanel() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState('campaigns');
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Row[]>([]);
  const [subs, setSubs] = useState<Row[]>([]);
  const [payouts, setPayouts] = useState<Row[]>([]);

  // Review dialog state
  const [reviewTarget, setReviewTarget] = useState<{
    type: EntityType;
    id: string;
    action: 'reviewed' | 'investigate';
  } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Verify admin role server-side. RLS also enforces this, but we gate the UI
  // and the data queries so non-admins never trigger the requests at all.
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    const [c, s, p] = await Promise.all([
      supabase.from('boost_campaigns').select('*').order('updated_at', { ascending: false }).limit(LIMIT),
      supabase.from('creator_subscriptions').select('*').order('updated_at', { ascending: false }).limit(LIMIT),
      supabase.from('payout_requests').select('*').order('created_at', { ascending: false }).limit(LIMIT),
    ]);

    const cRows = c.data ?? [];
    const sRows = s.data ?? [];
    const pRows = p.data ?? [];

    // Collect entity IDs to fetch their latest review.
    const allIds: string[] = [
      ...cRows.map((r: any) => r.id),
      ...sRows.map((r: any) => r.id),
      ...pRows.map((r: any) => r.id),
    ];
    const { data: reviews } = await supabase
      .from('moderation_reviews')
      .select('*')
      .in('entity_id', allIds)
      .order('reviewed_at', { ascending: false });

    const reviewerIds = (reviews ?? []).map((r: any) => r.reviewed_by);
    const profileIds = [
      ...cRows.map((r: any) => r.user_id),
      ...sRows.flatMap((r: any) => [r.subscriber_id, r.creator_id]),
      ...pRows.map((r: any) => r.user_id),
      ...reviewerIds,
    ];
    const profileMap = await fetchProfiles(profileIds);

    // Keep only the latest review per entity (list is already sorted desc).
    const latestByEntity = new Map<string, Review>();
    for (const r of (reviews ?? []) as Review[]) {
      if (!latestByEntity.has(r.entity_id)) {
        latestByEntity.set(r.entity_id, { ...r, _reviewer: profileMap.get(r.reviewed_by) ?? null });
      }
    }

    const attach = (rows: any[], primary: string, secondary?: string): Row[] =>
      rows.map((r) => ({
        ...r,
        _requester: profileMap.get(r[primary]) ?? null,
        _secondary: secondary ? profileMap.get(r[secondary]) ?? null : null,
        _review: latestByEntity.get(r.id) ?? null,
      }));

    setCampaigns(attach(cRows, 'user_id'));
    setSubs(attach(sRows, 'subscriber_id', 'creator_id'));
    setPayouts(attach(pRows, 'user_id'));
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const submitReview = async () => {
    if (!reviewTarget || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from('moderation_reviews').insert({
      entity_type: reviewTarget.type,
      entity_id: reviewTarget.id,
      action: reviewTarget.action,
      note: note.trim() || null,
      reviewed_by: user.id,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || 'Could not save review');
      return;
    }
    toast.success(
      reviewTarget.action === 'investigate' ? 'Investigation requested' : 'Marked as reviewed',
    );
    setReviewTarget(null);
    setNote('');
    load();
  };

  const openReview = (type: EntityType, id: string, action: 'reviewed' | 'investigate') => {
    setReviewTarget({ type, id, action });
    setNote('');
  };

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center space-y-2">
        <ShieldOff className="w-8 h-8 text-destructive mx-auto" />
        <p className="font-medium">Admins only</p>
        <p className="text-xs text-muted-foreground">
          You need a verified admin role to view the moderation feed.
        </p>
      </div>
    );
  }

  const Actions = ({ type, id }: { type: EntityType; id: string }) => (
    <div className="flex gap-2 pt-1">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => openReview(type, id, 'reviewed')}
      >
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
        Mark reviewed
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => openReview(type, id, 'investigate')}
      >
        <AlertTriangle className="w-3.5 h-3.5 mr-1" />
        Investigate
      </Button>
    </div>
  );

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
              {r._review && <ReviewBadge r={r._review} />}
              <Actions type="campaign" id={r.id} />
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
              {r._review && <ReviewBadge r={r._review} />}
              <Actions type="subscription" id={r.id} />
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
              {r._review && <ReviewBadge r={r._review} />}
              <Actions type="payout" id={r.id} />
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewTarget} onOpenChange={(o) => !o && setReviewTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewTarget?.action === 'investigate' ? 'Request investigation' : 'Mark as reviewed'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This action is logged with your admin identity and a timestamp.
            </p>
            <Textarea
              placeholder={reviewTarget?.action === 'investigate'
                ? 'Describe what looks suspicious (required context helps other admins).'
                : 'Optional note — reason for approval, checks performed, etc.'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={submitReview}
              disabled={submitting || (reviewTarget?.action === 'investigate' && !note.trim())}
              variant={reviewTarget?.action === 'investigate' ? 'destructive' : 'default'}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {reviewTarget?.action === 'investigate' ? 'Flag for investigation' : 'Confirm reviewed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
