import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ShieldCheck, KeyRound } from 'lucide-react';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface Props {
  open: boolean;
  factorId: string;
  userId: string;
  onVerified: () => void;
  onCancel: () => void;
}

export function LoginMfaChallenge({ open, factorId, userId, onVerified, onCancel }: Props) {
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      if (mode === 'totp') {
        const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
        if (chErr) throw chErr;
        const { error: vErr } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          code: code.trim(),
        });
        if (vErr) throw vErr;
        toast.success('Verified');
        onVerified();
      } else {
        const normalized = code.trim().toUpperCase();
        const hash = await sha256Hex(normalized);
        const { data: row, error } = await (supabase as any)
          .from('mfa_recovery_codes')
          .select('id, used')
          .eq('user_id', userId)
          .eq('code_hash', hash)
          .maybeSingle();
        if (error) throw error;
        if (!row || row.used) {
          toast.error('Invalid or already used recovery code');
          return;
        }
        await (supabase as any)
          .from('mfa_recovery_codes')
          .update({ used: true, used_at: new Date().toISOString() })
          .eq('id', row.id);
        toast.success('Recovery code accepted');
        onVerified();
      }
    } catch (e: any) {
      toast.error(e.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    // Sign the user back out because they did not complete 2FA
    await supabase.auth.signOut();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'totp' ? <ShieldCheck className="w-5 h-5 text-primary" /> : <KeyRound className="w-5 h-5 text-primary" />}
            Two-factor verification
          </DialogTitle>
          <DialogDescription>
            {mode === 'totp'
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Enter one of your saved recovery codes (format: XXXXX-XXXXX).'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label htmlFor="mfa-code">{mode === 'totp' ? 'Authenticator code' : 'Recovery code'}</Label>
          <Input
            id="mfa-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={mode === 'totp' ? '123456' : 'ABCDE-12345'}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={submit} disabled={busy || !code.trim()} className="w-full">
              {busy ? 'Verifying…' : 'Verify'}
            </Button>
            <Button
              variant="ghost"
              type="button"
              className="w-full"
              onClick={() => { setCode(''); setMode(mode === 'totp' ? 'recovery' : 'totp'); }}
            >
              {mode === 'totp' ? 'Use a recovery code instead' : 'Use authenticator app instead'}
            </Button>
            <Button variant="ghost" type="button" className="w-full text-muted-foreground" onClick={cancel}>
              Cancel and sign out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
