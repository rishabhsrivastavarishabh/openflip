import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Briefcase, Plus, Loader2, Send, Check, X, Trash2, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Deal {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  category: string;
  budget_min: number;
  budget_max: number;
  currency: string;
  deliverables: string;
  requirements: string | null;
  min_followers: number;
  deadline: string | null;
  status: string;
  created_at: string;
}

interface Application {
  id: string;
  deal_id: string;
  creator_id: string;
  message: string;
  proposed_rate: number | null;
  status: string;
  created_at: string;
}

const CATEGORIES = ['general', 'fashion', 'beauty', 'tech', 'food', 'travel', 'fitness', 'gaming', 'finance'];

export function BrandMarketplace({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { username: string; avatar_url: string | null }>>({});
  const [applyTo, setApplyTo] = useState<Deal | null>(null);
  const [pitch, setPitch] = useState('');
  const [rate, setRate] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', category: 'general', budget_min: '', budget_max: '',
    deliverables: '', requirements: '', min_followers: '', deadline: '',
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: openDeals }, { data: mine }, { data: apps }] = await Promise.all([
      (supabase as any).from('brand_deals').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(50),
      (supabase as any).from('brand_deals').select('*').eq('brand_id', user.id).order('created_at', { ascending: false }),
      (supabase as any).from('deal_applications').select('*').order('created_at', { ascending: false }),
    ]);
    setDeals((openDeals ?? []) as Deal[]);
    setMyDeals((mine ?? []) as Deal[]);
    setApplications((apps ?? []) as Application[]);

    const ids = Array.from(new Set([
      ...((openDeals ?? []) as Deal[]).map((d) => d.brand_id),
      ...((apps ?? []) as Application[]).map((a) => a.creator_id),
    ]));
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
      const map: Record<string, { username: string; avatar_url: string | null }> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = { username: p.username, avatar_url: p.avatar_url }; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const myApplications = useMemo(
    () => applications.filter((a) => a.creator_id === user?.id),
    [applications, user?.id],
  );
  const receivedApplications = useMemo(() => {
    const mineIds = new Set(myDeals.map((d) => d.id));
    return applications.filter((a) => mineIds.has(a.deal_id) && a.creator_id !== user?.id);
  }, [applications, myDeals, user?.id]);

  const appliedDealIds = useMemo(() => new Set(myApplications.map((a) => a.deal_id)), [myApplications]);

  const money = (d: Deal) =>
    d.budget_min === d.budget_max
      ? `₹${d.budget_min.toLocaleString('en-IN')}`
      : `₹${d.budget_min.toLocaleString('en-IN')} – ₹${d.budget_max.toLocaleString('en-IN')}`;

  const submitDeal = async () => {
    if (!user) return;
    if (!form.title.trim() || !form.deliverables.trim()) {
      toast.error('Add a title and the deliverables you expect');
      return;
    }
    setBusy(true);
    const { error } = await (supabase as any).from('brand_deals').insert({
      brand_id: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      budget_min: Number(form.budget_min || 0),
      budget_max: Number(form.budget_max || form.budget_min || 0),
      deliverables: form.deliverables.trim(),
      requirements: form.requirements.trim() || null,
      min_followers: Number(form.min_followers || 0),
      deadline: form.deadline || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Deal published to the marketplace');
    setCreating(false);
    setForm({ title: '', description: '', category: 'general', budget_min: '', budget_max: '', deliverables: '', requirements: '', min_followers: '', deadline: '' });
    load();
  };

  const submitApplication = async () => {
    if (!user || !applyTo) return;
    setBusy(true);
    const { error } = await (supabase as any).from('deal_applications').insert({
      deal_id: applyTo.id,
      creator_id: user.id,
      message: pitch.trim(),
      proposed_rate: rate ? Number(rate) : null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Application sent to the brand');
    setApplyTo(null); setPitch(''); setRate('');
    load();
  };

  const decide = async (id: string, status: 'accepted' | 'rejected') => {
    const { error } = await (supabase as any).from('deal_applications').update({ status }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'accepted' ? 'Creator accepted' : 'Application declined');
    load();
  };

  const closeDeal = async (id: string) => {
    const { error } = await (supabase as any).from('brand_deals').update({ status: 'closed' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const withdraw = async (id: string) => {
    const { error } = await (supabase as any).from('deal_applications').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Brand Marketplace</h1>
          <p className="text-sm text-muted-foreground">Find paid collaborations or hire creators</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="w-4 h-4 mr-1" />Post a deal</Button>
      </div>

      <Tabs defaultValue="browse">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="applied">Applied</TabsTrigger>
          <TabsTrigger value="mine">My deals</TabsTrigger>
          <TabsTrigger value="inbox">Applicants</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-3 mt-4">
          {deals.length === 0 && <Empty text="No open deals right now. Check back soon." />}
          {deals.map((d) => (
            <div key={d.id} className="p-4 rounded-xl border bg-card space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    by @{profiles[d.brand_id]?.username ?? 'brand'} · {d.category}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">{money(d)}</Badge>
              </div>
              {d.description && <p className="text-sm text-muted-foreground">{d.description}</p>}
              <p className="text-sm"><span className="text-muted-foreground">Deliverables: </span>{d.deliverables}</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {d.min_followers > 0 && <span>Min {d.min_followers.toLocaleString('en-IN')} followers</span>}
                {d.deadline && <span>Due {new Date(d.deadline).toLocaleDateString()}</span>}
              </div>
              {d.brand_id !== user?.id && (
                <Button
                  size="sm"
                  className="w-full"
                  disabled={appliedDealIds.has(d.id)}
                  onClick={() => { setApplyTo(d); setPitch(''); setRate(''); }}
                >
                  <Send className="w-4 h-4 mr-1" />
                  {appliedDealIds.has(d.id) ? 'Applied' : 'Apply'}
                </Button>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="applied" className="space-y-3 mt-4">
          {myApplications.length === 0 && <Empty text="You haven't applied to any deals yet." />}
          {myApplications.map((a) => (
            <div key={a.id} className="p-4 rounded-xl border bg-card flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-medium text-sm">
                  {deals.find((d) => d.id === a.deal_id)?.title ?? 'Deal'}
                </p>
                {a.message && <p className="text-xs text-muted-foreground">{a.message}</p>}
                {a.proposed_rate != null && (
                  <p className="text-xs flex items-center gap-1"><IndianRupee className="w-3 h-3" />{a.proposed_rate.toLocaleString('en-IN')}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={a.status === 'accepted' ? 'default' : a.status === 'rejected' ? 'destructive' : 'secondary'}>
                  {a.status}
                </Badge>
                {a.status === 'pending' && (
                  <Button variant="ghost" size="icon" onClick={() => withdraw(a.id)}><Trash2 className="w-4 h-4" /></Button>
                )}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3 mt-4">
          {myDeals.length === 0 && <Empty text="You haven't posted any deals yet." />}
          {myDeals.map((d) => (
            <div key={d.id} className="p-4 rounded-xl border bg-card flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{d.title}</p>
                <p className="text-xs text-muted-foreground">{money(d)} · {d.category}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {applications.filter((a) => a.deal_id === d.id).length} application(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={d.status === 'open' ? 'default' : 'secondary'}>{d.status}</Badge>
                {d.status === 'open' && <Button variant="outline" size="sm" onClick={() => closeDeal(d.id)}>Close</Button>}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="inbox" className="space-y-3 mt-4">
          {receivedApplications.length === 0 && <Empty text="No creator applications yet." />}
          {receivedApplications.map((a) => (
            <div key={a.id} className="p-4 rounded-xl border bg-card space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">@{profiles[a.creator_id]?.username ?? 'creator'}</p>
                  <p className="text-xs text-muted-foreground">
                    for {myDeals.find((d) => d.id === a.deal_id)?.title}
                  </p>
                </div>
                <Badge variant={a.status === 'accepted' ? 'default' : a.status === 'rejected' ? 'destructive' : 'secondary'}>
                  {a.status}
                </Badge>
              </div>
              {a.message && <p className="text-sm text-muted-foreground">{a.message}</p>}
              {a.proposed_rate != null && <p className="text-sm">Proposed: ₹{a.proposed_rate.toLocaleString('en-IN')}</p>}
              {a.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => decide(a.id, 'accepted')}><Check className="w-4 h-4 mr-1" />Accept</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => decide(a.id, 'rejected')}><X className="w-4 h-4 mr-1" />Decline</Button>
                </div>
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Post a deal */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-primary" />Post a brand deal</DialogTitle>
            <DialogDescription>Describe the campaign so creators can apply.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Summer collection reel" /></Field>
            <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></Field>
            <Field label="Category">
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Budget min (₹)"><Input inputMode="numeric" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value.replace(/\D/g, '') })} /></Field>
              <Field label="Budget max (₹)"><Input inputMode="numeric" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value.replace(/\D/g, '') })} /></Field>
            </div>
            <Field label="Deliverables"><Input value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} placeholder="1 reel + 2 stories" /></Field>
            <Field label="Requirements (optional)"><Textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={2} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min followers"><Input inputMode="numeric" value={form.min_followers} onChange={(e) => setForm({ ...form, min_followers: e.target.value.replace(/\D/g, '') })} /></Field>
              <Field label="Deadline"><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
            </div>
            <Button className="w-full" disabled={busy} onClick={submitDeal}>{busy ? 'Publishing…' : 'Publish deal'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Apply */}
      <Dialog open={!!applyTo} onOpenChange={(o) => { if (!o) setApplyTo(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply to {applyTo?.title}</DialogTitle>
            <DialogDescription>Tell the brand why you're a great fit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Your pitch"><Textarea rows={4} value={pitch} onChange={(e) => setPitch(e.target.value)} /></Field>
            <Field label="Proposed rate (₹, optional)"><Input inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g, ''))} /></Field>
            <Button className="w-full" disabled={busy} onClick={submitApplication}>{busy ? 'Sending…' : 'Send application'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-10">{text}</p>;
}
