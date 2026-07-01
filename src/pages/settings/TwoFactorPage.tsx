import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Shield, ShieldCheck, ShieldAlert, Smartphone, RefreshCw, Copy, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Factor = { id: string; friendly_name?: string | null; status: string };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${hex.slice(0, 5)}-${hex.slice(5, 10)}`;
}

export default function TwoFactorPage() {
  const { user } = useAuth();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [remainingCodes, setRemainingCodes] = useState<number>(0);

  // Enroll flow
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  // Recovery codes reveal
  const [codesOpen, setCodesOpen] = useState(false);
  const [revealedCodes, setRevealedCodes] = useState<string[]>([]);
  const [regenerating, setRegenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: mfa }, codes] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      (supabase as any)
        .from('mfa_recovery_codes')
        .select('id', { count: 'exact', head: true })
        .eq('used', false),
    ]);
    const totp = ((mfa?.totp ?? []) as any[]).map((f) => ({
      id: f.id, friendly_name: f.friendly_name, status: f.status,
    }));
    setFactors(totp);
    setRemainingCodes(codes?.count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activeTotp = factors.filter((f) => f.status === 'verified');
  const isEnabled = activeTotp.length > 0;

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      // Clean up any unverified factors first (fixes "friendly name already exists")
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of ((existing?.totp ?? []) as any[])) {
        if (f.status !== 'verified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const friendlyName = `Authenticator (${new Date().toISOString().slice(0, 10)})`;
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName,
      });
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp?.qr_code ?? null);
      setSecret(data.totp?.secret ?? null);
      setOtp('');
      setEnrollOpen(true);
    } catch (e: any) {
      toast.error(e.message || 'Failed to start 2FA enrollment');
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnroll = async () => {
    if (!factorId || otp.length < 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId, challengeId: challenge.id, code: otp,
      });
      if (vErr) throw vErr;
      toast.success('Two-factor authentication enabled');
      setEnrollOpen(false);
      setQr(null); setSecret(null); setFactorId(null); setOtp('');
      await load();
      // Auto-generate initial recovery codes
      await regenerateCodes();
    } catch (e: any) {
      toast.error(e.message || 'Verification failed');
    }
  };

  const disableFactor = async (id: string) => {
    if (!confirm('Disable two-factor authentication? Your recovery codes will also be revoked.')) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return toast.error(error.message);
    await (supabase as any).from('mfa_recovery_codes').delete().eq('user_id', user?.id);
    toast.success('2FA disabled');
    await load();
  };

  const regenerateCodes = async () => {
    if (!user) return;
    setRegenerating(true);
    try {
      // Wipe old codes
      await (supabase as any).from('mfa_recovery_codes').delete().eq('user_id', user.id);
      // Generate 10 fresh codes
      const codes = Array.from({ length: 10 }, generateCode);
      const rows = await Promise.all(codes.map(async (c) => ({
        user_id: user.id,
        code_hash: await sha256Hex(c),
        used: false,
      })));
      const { error } = await (supabase as any).from('mfa_recovery_codes').insert(rows);
      if (error) throw error;
      setRevealedCodes(codes);
      setCodesOpen(true);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate recovery codes');
    } finally {
      setRegenerating(false);
    }
  };

  const copyAll = () => {
    navigator.clipboard.writeText(revealedCodes.join('\n'));
    toast.success('Copied to clipboard');
  };

  const downloadTxt = () => {
    const blob = new Blob(
      [`Openflip 2FA recovery codes\nGenerated: ${new Date().toISOString()}\n\n${revealedCodes.join('\n')}\n`],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'openflip-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold mb-1">Two-factor authentication</h2>
        <p className="text-sm text-muted-foreground">
          Add a second step at sign-in using an authenticator app.
        </p>
      </section>

      {/* Status card */}
      <section
        className={`border rounded-2xl p-5 ${
          isEnabled ? 'bg-green-500/5 border-green-500/30' : 'bg-yellow-500/5 border-yellow-500/30'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${
              isEnabled ? 'bg-green-500/15' : 'bg-yellow-500/15'
            }`}
          >
            {isEnabled ? (
              <ShieldCheck className="w-6 h-6 text-green-600" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-yellow-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold">
              {loading ? 'Checking status…' : isEnabled ? '2FA is enabled' : '2FA is not enabled'}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEnabled
                ? 'Your account requires a verification code at sign-in.'
                : 'Turn on 2FA to protect your account against password theft.'}
            </p>
          </div>
          {!loading && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${
                isEnabled ? 'bg-green-500/15 text-green-700' : 'bg-yellow-500/15 text-yellow-700'
              }`}
            >
              {isEnabled ? 'On' : 'Off'}
            </span>
          )}
        </div>

        <div className="mt-4">
          {!isEnabled ? (
            <Button onClick={startEnroll} disabled={enrolling}>
              {enrolling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              Enable 2FA
            </Button>
          ) : (
            <div className="space-y-2">
              {activeTotp.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-background/60 border"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    <span className="text-sm">{f.friendly_name || 'Authenticator app'}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => disableFactor(f.id)}>
                    Disable
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recovery codes */}
      <section className="border rounded-2xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Backup / recovery codes</h3>
            <p className="text-sm text-muted-foreground">
              One-time codes to sign in if you lose your authenticator device.
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            {remainingCodes} unused
          </span>
        </div>
        <Button
          variant="outline"
          onClick={regenerateCodes}
          disabled={!isEnabled || regenerating}
        >
          {regenerating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {remainingCodes > 0 ? 'Regenerate codes' : 'Generate codes'}
        </Button>
        {!isEnabled && (
          <p className="text-xs text-muted-foreground">
            Enable 2FA first to generate recovery codes.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Regenerating invalidates all previous codes. Store them in a password manager.
        </p>
      </section>

      {/* Enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable two-factor authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code.
            </DialogDescription>
          </DialogHeader>
          {qr && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="bg-white p-3 rounded-lg"
                dangerouslySetInnerHTML={{
                  __html: qr.startsWith('data:') ? `<img src="${qr}" alt="2FA QR" />` : qr,
                }}
              />
              {secret && (
                <div className="text-xs text-muted-foreground text-center">
                  Can't scan? Enter this key manually:
                  <br />
                  <code className="font-mono break-all">{secret}</code>
                </div>
              )}
            </div>
          )}
          <div>
            <Label htmlFor="otp">Verification code</Label>
            <Input
              id="otp"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button onClick={verifyEnroll}>Verify and enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal recovery codes dialog */}
      <Dialog open={codesOpen} onOpenChange={setCodesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your recovery codes</DialogTitle>
            <DialogDescription>
              These codes are shown only once. Store them somewhere safe — each can be used once
              to sign in if you lose access to your authenticator.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm p-4 bg-muted rounded-xl">
            {revealedCodes.map((c) => (
              <div key={c} className="tracking-wider">{c}</div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={copyAll}>
              <Copy className="w-4 h-4 mr-2" /> Copy
            </Button>
            <Button variant="outline" onClick={downloadTxt}>
              <Download className="w-4 h-4 mr-2" /> Download
            </Button>
            <Button onClick={() => setCodesOpen(false)}>I've saved them</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
