import { useEffect, useState } from 'react';
import {
  ArrowLeft, Plus, Loader2, KeyRound, Webhook, Boxes, BookOpen, Copy, Trash2,
  ShieldAlert, PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface DevApp { id: string; name: string; description: string | null; website_url: string | null; redirect_uris: string[]; environment: string; status: string; created_at: string }
interface ApiKey { id: string; app_id: string | null; label: string; key_prefix: string; scopes: string[]; environment: string; last_used_at: string | null; revoked_at: string | null; created_at: string }
interface Hook { id: string; app_id: string | null; url: string; events: string[]; signing_secret: string; is_active: boolean; created_at: string }

const SCOPES = ['profile:read', 'posts:read', 'posts:write', 'reels:read', 'analytics:read'];
const EVENTS = ['post.created', 'reel.created', 'follow.created', 'comment.created', 'subscription.updated'];

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(len = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes).map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, len * 1.5);
}

export function DeveloperPlatform({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [has2fa, setHas2fa] = useState(false);
  const [apps, setApps] = useState<DevApp[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [busy, setBusy] = useState(false);

  const [appDialog, setAppDialog] = useState(false);
  const [appForm, setAppForm] = useState({ name: '', description: '', website_url: '', redirect_uris: '', environment: 'sandbox' });

  const [keyDialog, setKeyDialog] = useState(false);
  const [keyForm, setKeyForm] = useState<{ label: string; app_id: string; scopes: string[]; environment: string }>({ label: 'Default key', app_id: '', scopes: ['profile:read'], environment: 'sandbox' });
  const [newKey, setNewKey] = useState<string | null>(null);

  const [hookDialog, setHookDialog] = useState(false);
  const [hookForm, setHookForm] = useState<{ url: string; app_id: string; events: string[] }>({ url: '', app_id: '', events: ['post.created'] });

  const [sandboxOut, setSandboxOut] = useState<string>('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: mfa } = await supabase.auth.mfa.listFactors();
    setHas2fa(((mfa?.totp ?? []) as any[]).some((f) => f.status === 'verified'));
    const [{ data: a }, { data: k }, { data: w }] = await Promise.all([
      (supabase as any).from('developer_apps').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('api_keys').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('webhook_endpoints').select('*').order('created_at', { ascending: false }),
    ]);
    setApps((a ?? []) as DevApp[]);
    setKeys((k ?? []) as ApiKey[]);
    setHooks((w ?? []) as Hook[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const createApp = async () => {
    if (!user || !appForm.name.trim()) { toast.error('Give your app a name'); return; }
    setBusy(true);
    const { error } = await (supabase as any).from('developer_apps').insert({
      user_id: user.id,
      name: appForm.name.trim(),
      description: appForm.description.trim() || null,
      website_url: appForm.website_url.trim() || null,
      environment: appForm.environment,
      redirect_uris: appForm.redirect_uris.split('\n').map((s) => s.trim()).filter(Boolean),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('App created');
    setAppDialog(false);
    setAppForm({ name: '', description: '', website_url: '', redirect_uris: '', environment: 'sandbox' });
    load();
  };

  const deleteApp = async (id: string) => {
    const { error } = await (supabase as any).from('developer_apps').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const createKey = async () => {
    if (!user) return;
    setBusy(true);
    const prefix = keyForm.environment === 'live' ? 'ofl_live' : 'ofl_test';
    const raw = `${prefix}_${randomToken(24)}`;
    const hash = await sha256Hex(raw);
    const { error } = await (supabase as any).from('api_keys').insert({
      user_id: user.id,
      app_id: keyForm.app_id || null,
      label: keyForm.label.trim() || 'Default key',
      key_prefix: raw.slice(0, 16),
      key_hash: hash,
      scopes: keyForm.scopes,
      environment: keyForm.environment,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setKeyDialog(false);
    setNewKey(raw);
    load();
  };

  const revokeKey = async (id: string) => {
    const { error } = await (supabase as any).from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Key revoked');
    load();
  };

  const createHook = async () => {
    if (!user || !hookForm.url.trim().startsWith('https://')) {
      toast.error('Enter an https:// endpoint URL');
      return;
    }
    setBusy(true);
    const { error } = await (supabase as any).from('webhook_endpoints').insert({
      user_id: user.id,
      app_id: hookForm.app_id || null,
      url: hookForm.url.trim(),
      events: hookForm.events,
      signing_secret: `whsec_${randomToken(20)}`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Webhook added');
    setHookDialog(false);
    setHookForm({ url: '', app_id: '', events: ['post.created'] });
    load();
  };

  const toggleHook = async (h: Hook) => {
    await (supabase as any).from('webhook_endpoints').update({ is_active: !h.is_active }).eq('id', h.id);
    load();
  };

  const deleteHook = async (id: string) => {
    await (supabase as any).from('webhook_endpoints').delete().eq('id', id);
    load();
  };

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success('Copied'); };

  const runSandbox = async () => {
    setSandboxOut('Running…');
    const { data, error } = await supabase.rpc('get_my_private_profile');
    if (error) { setSandboxOut(`Error: ${error.message}`); return; }
    const { data: profile } = await supabase.from('profiles').select('id, username, full_name, is_verified').eq('id', user!.id).maybeSingle();
    setSandboxOut(JSON.stringify({ endpoint: 'GET /v1/me', status: 200, data: { ...profile, private_fields_available: !!data } }, null, 2));
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const gate = (children: React.ReactNode) =>
    has2fa ? children : (
      <div className="p-6 rounded-xl border bg-card text-center space-y-3 mt-4">
        <ShieldAlert className="w-8 h-8 mx-auto text-primary" />
        <div>
          <p className="font-semibold">Two-factor authentication required</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            API keys and webhooks can act on your account, so they're locked behind 2FA. Apps, docs and the sandbox stay available.
          </p>
        </div>
        <Button onClick={() => navigate('/settings/two-factor')}>Enable 2FA</Button>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Developer Platform</h1>
          <p className="text-sm text-muted-foreground">Apps, API keys, webhooks, docs and a sandbox</p>
        </div>
        <Badge variant={has2fa ? 'default' : 'secondary'}>{has2fa ? '2FA on' : '2FA off'}</Badge>
      </div>

      <Tabs defaultValue="apps">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="apps">Apps</TabsTrigger>
          <TabsTrigger value="keys">Keys</TabsTrigger>
          <TabsTrigger value="hooks">Webhooks</TabsTrigger>
          <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
        </TabsList>

        {/* Apps */}
        <TabsContent value="apps" className="space-y-3 mt-4">
          <Button size="sm" onClick={() => setAppDialog(true)}><Plus className="w-4 h-4 mr-1" />New app</Button>
          {apps.length === 0 && <Empty text="No apps yet. Create one to get a client ID and keys." />}
          {apps.map((a) => (
            <div key={a.id} className="p-4 rounded-xl border bg-card space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm flex items-center gap-2"><Boxes className="w-4 h-4 text-primary" />{a.name}</p>
                  {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{a.environment}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => deleteApp(a.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <code className="truncate">client_id: {a.id}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(a.id)}><Copy className="w-3 h-3" /></Button>
              </div>
              {a.redirect_uris.length > 0 && (
                <p className="text-xs text-muted-foreground">Redirects: {a.redirect_uris.join(', ')}</p>
              )}
            </div>
          ))}
        </TabsContent>

        {/* API keys */}
        <TabsContent value="keys">
          {gate(
            <div className="space-y-3 mt-4">
              <Button size="sm" onClick={() => setKeyDialog(true)}><Plus className="w-4 h-4 mr-1" />Create key</Button>
              {keys.length === 0 && <Empty text="No API keys yet." />}
              {keys.map((k) => (
                <div key={k.id} className="p-4 rounded-xl border bg-card flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-sm flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" />{k.label}</p>
                    <code className="text-xs text-muted-foreground block truncate">{k.key_prefix}••••••••</code>
                    <p className="text-xs text-muted-foreground">{k.scopes.join(', ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={k.revoked_at ? 'destructive' : 'default'}>{k.revoked_at ? 'revoked' : k.environment}</Badge>
                    {!k.revoked_at && <Button variant="outline" size="sm" onClick={() => revokeKey(k.id)}>Revoke</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Webhooks */}
        <TabsContent value="hooks">
          {gate(
            <div className="space-y-3 mt-4">
              <Button size="sm" onClick={() => setHookDialog(true)}><Plus className="w-4 h-4 mr-1" />Add endpoint</Button>
              {hooks.length === 0 && <Empty text="No webhook endpoints yet." />}
              {hooks.map((h) => (
                <div key={h.id} className="p-4 rounded-xl border bg-card space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm flex items-center gap-2"><Webhook className="w-4 h-4 text-primary" /><span className="truncate">{h.url}</span></p>
                      <p className="text-xs text-muted-foreground">{h.events.join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={h.is_active} onCheckedChange={() => toggleHook(h)} />
                      <Button variant="ghost" size="icon" onClick={() => deleteHook(h.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground truncate">{h.signing_secret}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(h.signing_secret)}><Copy className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Sandbox */}
        <TabsContent value="sandbox" className="space-y-3 mt-4">
          <div className="p-4 rounded-xl border bg-card space-y-3">
            <p className="text-sm font-medium">Try an API call</p>
            <p className="text-xs text-muted-foreground">
              Runs <code>GET /v1/me</code> against your own account using your signed-in session — no key needed while testing.
            </p>
            <Button size="sm" onClick={runSandbox}><PlayCircle className="w-4 h-4 mr-1" />Run request</Button>
            {sandboxOut && (
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{sandboxOut}</pre>
            )}
          </div>
        </TabsContent>

        {/* Docs */}
        <TabsContent value="docs" className="space-y-3 mt-4">
          <Doc title="Authentication">
            Send your key as a bearer token on every request:
            {'\n'}<code>Authorization: Bearer ofl_live_...</code>
            {'\n'}Test keys (<code>ofl_test_</code>) only reach sandbox data.
          </Doc>
          <Doc title="Scopes">{SCOPES.join('\n')}</Doc>
          <Doc title="Endpoints">
            {'GET  /v1/me\nGET  /v1/posts\nPOST /v1/posts\nGET  /v1/reels\nGET  /v1/analytics/overview'}
          </Doc>
          <Doc title="Webhooks">
            Each delivery is signed with your endpoint secret in the <code>X-Openflip-Signature</code> header
            (HMAC SHA-256 of the raw body). Respond with 2xx within 5 seconds; failures retry with backoff.
            {'\n\nEvents: '}{EVENTS.join(', ')}
          </Doc>
          <Doc title="Rate limits">
            {'Sandbox: 60 requests/minute\nLive: 600 requests/minute per key\n429 responses include Retry-After.'}
          </Doc>
        </TabsContent>
      </Tabs>

      {/* New app dialog */}
      <Dialog open={appDialog} onOpenChange={setAppDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New app</DialogTitle><DialogDescription>Register an integration that talks to Openflip.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Field label="Name"><Input value={appForm.name} onChange={(e) => setAppForm({ ...appForm, name: e.target.value })} /></Field>
            <Field label="Description"><Textarea rows={2} value={appForm.description} onChange={(e) => setAppForm({ ...appForm, description: e.target.value })} /></Field>
            <Field label="Website"><Input value={appForm.website_url} onChange={(e) => setAppForm({ ...appForm, website_url: e.target.value })} placeholder="https://" /></Field>
            <Field label="Redirect URIs (one per line)"><Textarea rows={2} value={appForm.redirect_uris} onChange={(e) => setAppForm({ ...appForm, redirect_uris: e.target.value })} placeholder="https://yourapp.com/callback" /></Field>
            <Field label="Environment">
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={appForm.environment} onChange={(e) => setAppForm({ ...appForm, environment: e.target.value })}>
                <option value="sandbox">sandbox</option>
                <option value="live">live</option>
              </select>
            </Field>
            <Button className="w-full" disabled={busy} onClick={createApp}>{busy ? 'Creating…' : 'Create app'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New key dialog */}
      <Dialog open={keyDialog} onOpenChange={setKeyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create API key</DialogTitle><DialogDescription>The key is shown once — store it safely.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Field label="Label"><Input value={keyForm.label} onChange={(e) => setKeyForm({ ...keyForm, label: e.target.value })} /></Field>
            <Field label="App (optional)">
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={keyForm.app_id} onChange={(e) => setKeyForm({ ...keyForm, app_id: e.target.value })}>
                <option value="">No app</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Environment">
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={keyForm.environment} onChange={(e) => setKeyForm({ ...keyForm, environment: e.target.value })}>
                <option value="sandbox">sandbox</option>
                <option value="live">live</option>
              </select>
            </Field>
            <Field label="Scopes">
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((s) => {
                  const on = keyForm.scopes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setKeyForm({ ...keyForm, scopes: on ? keyForm.scopes.filter((x) => x !== s) : [...keyForm.scopes, s] })}
                      className={`text-xs px-2.5 py-1 rounded-full border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}
                    >{s}</button>
                  );
                })}
              </div>
            </Field>
            <Button className="w-full" disabled={busy || keyForm.scopes.length === 0} onClick={createKey}>{busy ? 'Creating…' : 'Create key'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reveal key once */}
      <Dialog open={!!newKey} onOpenChange={(o) => { if (!o) setNewKey(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Your new API key</DialogTitle><DialogDescription>Copy it now — it won't be shown again.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <code className="block text-xs bg-muted rounded-lg p-3 break-all">{newKey}</code>
            <Button className="w-full" onClick={() => { copy(newKey!); setNewKey(null); }}><Copy className="w-4 h-4 mr-1" />Copy and close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New webhook dialog */}
      <Dialog open={hookDialog} onOpenChange={setHookDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add webhook endpoint</DialogTitle><DialogDescription>We'll POST signed events to this URL.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Field label="Endpoint URL"><Input value={hookForm.url} onChange={(e) => setHookForm({ ...hookForm, url: e.target.value })} placeholder="https://yourapp.com/webhooks/openflip" /></Field>
            <Field label="App (optional)">
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={hookForm.app_id} onChange={(e) => setHookForm({ ...hookForm, app_id: e.target.value })}>
                <option value="">No app</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Events">
              <div className="flex flex-wrap gap-2">
                {EVENTS.map((ev) => {
                  const on = hookForm.events.includes(ev);
                  return (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => setHookForm({ ...hookForm, events: on ? hookForm.events.filter((x) => x !== ev) : [...hookForm.events, ev] })}
                      className={`text-xs px-2.5 py-1 rounded-full border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}
                    >{ev}</button>
                  );
                })}
              </div>
            </Field>
            <Button className="w-full" disabled={busy || hookForm.events.length === 0} onClick={createHook}>{busy ? 'Adding…' : 'Add endpoint'}</Button>
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

function Doc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border bg-card space-y-2">
      <p className="font-medium text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" />{title}</p>
      <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{children}</div>
    </div>
  );
}
