import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Shield, ShieldCheck, KeyRound, Trash2, Smartphone, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type Factor = { id: string; friendly_name?: string | null; factor_type: string; status: string };

export default function SecurityPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Change password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  // 2FA
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [delPassword, setDelPassword] = useState('');
  const [delConfirm, setDelConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = (data?.totp ?? []) as any[];
    setFactors(totp.map((f) => ({ id: f.id, friendly_name: f.friendly_name, factor_type: 'totp', status: f.status })));
  };

  useEffect(() => { loadFactors(); }, []);

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPw(false);
    if (error) {
      toast.error(error.message || 'Failed to change password');
    } else {
      toast.success('Password changed');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Openflip.in (${new Date().toISOString().slice(0, 10)})`,
        issuer: 'Openflip.in',
      } as any);
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp?.qr_code ?? null);
      setSecret(data.totp?.secret ?? null);
      setEnrollOpen(true);
    } catch (e: any) {
      toast.error(e.message || 'Failed to start 2FA enrollment');
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnroll = async () => {
    if (!factorId) return;
    if (otp.length < 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: otp,
      });
      if (vErr) throw vErr;
      toast.success('Two-factor authentication enabled');
      setEnrollOpen(false);
      setOtp(''); setQr(null); setSecret(null); setFactorId(null);
      loadFactors();
    } catch (e: any) {
      toast.error(e.message || 'Verification failed');
    }
  };

  const disableFactor = async (id: string) => {
    if (!confirm('Disable two-factor authentication for this device?')) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) toast.error(error.message);
    else {
      toast.success('2FA disabled');
      loadFactors();
    }
  };

  const signOutAll = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) toast.error(error.message);
    else {
      toast.success('Signed out of all devices');
      navigate('/auth');
    }
  };

  const handleDelete = async () => {
    if (delConfirm !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    if (!delPassword) {
      toast.error('Enter your password');
      return;
    }
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { password: delPassword, confirmation: delConfirm },
      });
      if (error) {
        const msg = (data as any)?.error || error.message || 'Failed to delete account';
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Account deleted');
      await signOut();
      navigate('/auth', { replace: true });
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const activeTotp = factors.filter((f) => f.status === 'verified');

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-1">Security</h2>
        <p className="text-sm text-muted-foreground">Manage password, two-factor authentication, sessions, and account deletion.</p>
      </section>

      {/* Change password */}
      <section className="space-y-3 border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4" />
          <h3 className="font-semibold">Change password</h3>
        </div>
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        </div>
        <Button onClick={handleChangePassword} disabled={changingPw}>
          {changingPw ? 'Changing...' : 'Change password'}
        </Button>
      </section>

      {/* 2FA */}
      <section className="space-y-3 border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          {activeTotp.length > 0 ? <ShieldCheck className="w-4 h-4 text-green-600" /> : <Shield className="w-4 h-4" />}
          <h3 className="font-semibold">Two-factor authentication</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Add an extra layer of security using an authenticator app (Google Authenticator, 1Password, Authy).
        </p>
        {activeTotp.length === 0 ? (
          <Button onClick={startEnroll} disabled={enrolling}>
            {enrolling ? 'Preparing...' : 'Enable 2FA'}
          </Button>
        ) : (
          <div className="space-y-2">
            {activeTotp.map((f) => (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  <span className="text-sm">{f.friendly_name || 'Authenticator app'}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => disableFactor(f.id)}>Disable</Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active sessions */}
      <section className="space-y-3 border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Smartphone className="w-4 h-4" />
          <h3 className="font-semibold">Active sessions</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          You are signed in as <span className="font-medium">{user?.email}</span>. Sign out of every device if you suspect your account is compromised.
        </p>
        <Button variant="outline" onClick={signOutAll}>Sign out of all devices</Button>
      </section>

      {/* Delete account */}
      <section className="space-y-3 border border-destructive/40 rounded-2xl p-4 bg-destructive/5">
        <div className="flex items-center gap-2 mb-1 text-destructive">
          <AlertTriangle className="w-4 h-4" />
          <h3 className="font-semibold">Delete account</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently delete your account and all associated data — posts, reels, messages, subscriptions.
          This action cannot be undone.
        </p>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="w-4 h-4 mr-2" /> Delete my account
        </Button>
      </section>

      {/* Enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable two-factor authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code below.
            </DialogDescription>
          </DialogHeader>
          {qr && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="bg-white p-3 rounded-lg"
                // Supabase returns an inline SVG data URL or raw SVG string
                dangerouslySetInnerHTML={{
                  __html: qr.startsWith('data:') ? `<img src="${qr}" alt="2FA QR" />` : qr,
                }}
              />
              {secret && (
                <div className="text-xs text-muted-foreground">
                  Can't scan? Enter this key manually: <code className="font-mono">{secret}</code>
                </div>
              )}
            </div>
          )}
          <div>
            <Label htmlFor="otp">Verification code</Label>
            <Input id="otp" inputMode="numeric" maxLength={6} value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Cancel</Button>
            <Button onClick={verifyEnroll}>Verify and enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account permanently?</DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all associated data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="del-password">Confirm your password</Label>
              <Input id="del-password" type="password" value={delPassword}
                onChange={(e) => setDelPassword(e.target.value)}
                autoComplete="current-password" />
            </div>
            <div>
              <Label htmlFor="del-confirm">Type <span className="font-mono font-semibold">DELETE</span> to confirm</Label>
              <Input id="del-confirm" value={delConfirm}
                onChange={(e) => setDelConfirm(e.target.value)}
                placeholder="DELETE" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Permanently delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
