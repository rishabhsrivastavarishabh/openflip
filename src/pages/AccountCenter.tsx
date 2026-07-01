import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Shield, Crown, CreditCard, Users, Lock, Trash2, ChevronRight, FileText, Camera, Edit3, Key, Smartphone, Mail, Globe, MapPin } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { AccountSwitcher } from '@/components/account/AccountSwitcher';
import { AvatarCropDialog } from '@/components/settings/AvatarCropDialog';
import { SubscriptionSettings } from '@/components/subscription/SubscriptionSettings';

const ACCOUNT_TYPES = ['Personal', 'Creator', 'Business', 'Brand', 'Shop', 'Influencer', 'Organization'];
const CATEGORIES = ['Art', 'Music', 'Photography', 'Fashion', 'Food', 'Travel', 'Fitness', 'Tech', 'Education', 'Entertainment', 'News', 'Sports', 'Gaming', 'Health', 'Beauty', 'Lifestyle', 'Other'];

type Section = 'main' | 'profile' | 'security' | 'subscription' | 'payments' | 'privacy' | 'delete';

export default function AccountCenter() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>('main');
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [subscription, setSubscription] = useState<any>(null);
  const [planName, setPlanName] = useState('Free');
  const [payments, setPayments] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    bio: '',
    website: '',
    phone_number: '',
    business_email: '',
    business_category: '',
    account_type: 'personal',
    gender: '',
  });

  const [privacyToggles, setPrivacyToggles] = useState({
    showEmail: true,
    showPhone: false,
    showWebsite: true,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        website: profile.website || '',
        phone_number: (profile as any).phone_number || '',
        business_email: (profile as any).business_email || '',
        business_category: (profile as any).business_category || '',
        account_type: (profile as any).account_type || 'personal',
        gender: (profile as any).gender || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      fetchSubscription();
      fetchPayments();
    }
  }, [user]);

  const fetchSubscription = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (data) {
      setSubscription(data);
      setPlanName((data as any).subscription_plans?.name || 'Free');
    }
  };

  const fetchPayments = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('payment_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setPayments(data || []);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setCropFile(file);
    setShowCropDialog(true);
    e.target.value = '';
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    if (!user) return;
    setSavingAvatar(true);
    try {
      const fileName = `${user.id}/avatar.png`;
      await supabase.storage.from('media').upload(fileName, blob, { upsert: true, contentType: 'image/png' });
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
      await updateProfile({ avatar_url: `${publicUrl}?t=${Date.now()}` });
      toast.success('Avatar updated!');
      setShowCropDialog(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update avatar');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    // Validate website URL: must be http(s) to prevent javascript:/data: XSS
    const websiteInput = (formData.website || '').trim();
    if (websiteInput && !/^https?:\/\//i.test(websiteInput)) {
      toast.error('Website must start with http:// or https://');
      return;
    }
    setSaving(true);
    const { error } = await updateProfile({
      username: formData.username,
      full_name: formData.full_name || null,
      bio: formData.bio || null,
      website: websiteInput || null,
    });
    
    // Update extended fields via direct update
    await supabase.from('profiles').update({
      phone_number: formData.phone_number || null,
      business_email: formData.business_email || null,
      business_category: formData.business_category || null,
      account_type: formData.account_type || 'personal',
      gender: formData.gender || null,
    }).eq('id', user!.id);

    setSaving(false);
    if (error) toast.error('Failed to save');
    else toast.success('Profile updated!');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    toast.error('Account deletion requires admin action. Please contact support.');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const downloadInvoice = (payment: any) => {
    const baseAmount = Math.round(payment.amount / 1.18);
    const gst = payment.amount - baseAmount;
    const invoice = `
═══════════════════════════════════════
           OPENFLIP INVOICE
═══════════════════════════════════════

Invoice Date: ${new Date(payment.created_at).toLocaleDateString('en-IN')}
Transaction ID: ${payment.stripe_payment_intent_id || payment.id.slice(0, 12)}
Status: ${payment.status.toUpperCase()}

───────────────────────────────────────
Description: ${payment.description || 'Subscription Payment'}
───────────────────────────────────────

Subtotal:     ₹${(baseAmount / 100).toFixed(2)}
GST (18%):    ₹${(gst / 100).toFixed(2)}
───────────────────────────────────────
Total:        ₹${(payment.amount / 100).toFixed(2)}

Currency: INR

═══════════════════════════════════════
           Thank you for using Openflip!
═══════════════════════════════════════
`;
    const blob = new Blob([invoice], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openflip-invoice-${payment.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) { navigate('/auth'); return null; }

  if (section === 'subscription') {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <SubscriptionSettings onBack={() => setSection('main')} />
        </div>
      </MainLayout>
    );
  }

  if (section === 'profile') {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSection('main')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Edit Profile</h1>
            </div>
          </header>
          <div className="p-4 space-y-6">
            {/* Avatar */}
            <div className="flex justify-center">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer">
                  <Camera className="h-4 w-4" />
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
              </div>
            </div>

            {/* Account Type */}
            <div className="space-y-2">
              <Label>Account Type</Label>
              <Select value={formData.account_type} onValueChange={(v) => setFormData({ ...formData, account_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => (
                    <SelectItem key={t} value={t.toLowerCase()}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.business_category || ''} onValueChange={(v) => setFormData({ ...formData, business_category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} rows={3} className="resize-none" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.business_email} onChange={(e) => setFormData({ ...formData, business_email: e.target.value })} placeholder="Public email" />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={formData.phone_number} onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })} placeholder="+91..." />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={formData.gender || ''} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Prefer not to say" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non-binary">Non-binary</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Privacy Toggles */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase">Field Visibility</h3>
              {[
                { key: 'showEmail', label: 'Show Email on Profile', icon: Mail },
                { key: 'showPhone', label: 'Show Phone on Profile', icon: Smartphone },
                { key: 'showWebsite', label: 'Show Website on Profile', icon: Globe },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{label}</span>
                  </div>
                  <Switch
                    checked={privacyToggles[key as keyof typeof privacyToggles]}
                    onCheckedChange={(c) => setPrivacyToggles({ ...privacyToggles, [key]: c })}
                  />
                </div>
              ))}
            </div>

            <Button variant="gradient" onClick={handleSaveProfile} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (section === 'payments') {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSection('main')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Payments & Invoices</h1>
            </div>
          </header>
          <div className="p-4 space-y-3">
            {payments.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No payment history</p>
              </div>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="p-4 rounded-xl bg-secondary/50 border space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{p.description || 'Payment'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{(p.amount / 100).toFixed(2)}</p>
                      <Badge variant={p.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    TXN: {p.stripe_payment_intent_id || p.id.slice(0, 12)}
                  </p>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => downloadInvoice(p)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Download Invoice
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (section === 'security') {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSection('main')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Security & Login</h1>
            </div>
          </header>
          <div className="p-4 space-y-4">
            <div className="p-4 rounded-xl bg-secondary/50 border space-y-3">
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Change Password</p>
                  <p className="text-sm text-muted-foreground">Update your password for security</p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => {
                supabase.auth.resetPasswordForEmail(user.email!, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                toast.success('Password reset email sent!');
              }}>
                Send Reset Link
              </Button>
            </div>

            <div className="p-4 rounded-xl bg-secondary/50 border">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Login Email</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-secondary/50 border">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Active Sessions</p>
                  <p className="text-sm text-muted-foreground">Current device</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (section === 'privacy') {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSection('main')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Privacy Controls</h1>
            </div>
          </header>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Private Account</p>
                  <p className="text-sm text-muted-foreground">Only followers see your posts</p>
                </div>
              </div>
              <Switch
                checked={profile?.is_private || false}
                onCheckedChange={async (checked) => {
                  await updateProfile({ is_private: checked });
                  toast.success(checked ? 'Account is now private' : 'Account is now public');
                }}
              />
            </div>
            <Button variant="outline" className="w-full justify-between" onClick={() => navigate(`/profile/${profile?.username}/followers`)}>
              Manage Followers
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (section === 'delete') {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSection('main')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg text-destructive">Delete Account</h1>
            </div>
          </header>
          <div className="p-4 space-y-4">
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 space-y-3">
              <p className="font-medium text-destructive">This action is irreversible</p>
              <p className="text-sm text-muted-foreground">All your data, posts, messages, and subscriptions will be permanently deleted.</p>
              <Input
                placeholder='Type "DELETE" to confirm'
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
              />
              <Button variant="destructive" className="w-full" onClick={handleDeleteAccount} disabled={deleteConfirm !== 'DELETE'}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete My Account
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Main Account Center
  return (
    <MainLayout>
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg">Account Center</h1>
          </div>
        </header>

        <div className="p-4 space-y-4">
          {/* User Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xl bg-primary/10 text-primary">
                  {profile?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-lg truncate">{profile?.username}</p>
                  {profile?.is_verified && <VerifiedBadge size="sm" />}
                </div>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                <Badge variant="secondary" className="mt-1 text-xs capitalize">
                  {(profile as any)?.account_type || 'Personal'} · {planName}
                </Badge>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-1">
            {[
              { icon: Edit3, label: 'Profile Info & Edit', desc: 'Username, bio, avatar, category', section: 'profile' as Section },
              { icon: Shield, label: 'Security & Login', desc: 'Password, sessions', section: 'security' as Section },
              { icon: Crown, label: 'Subscription', desc: `Current plan: ${planName}`, section: 'subscription' as Section },
              { icon: CreditCard, label: 'Payments & Invoices', desc: `${payments.length} transactions`, section: 'payments' as Section },
              { icon: Lock, label: 'Privacy Controls', desc: profile?.is_private ? 'Private account' : 'Public account', section: 'privacy' as Section },
            ].map(({ icon: Icon, label, desc, section: s }) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/70 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>

          <Separator />

          {/* Switch / Add Account */}
          <button
            onClick={() => setShowAccountSwitcher(true)}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/70 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Switch / Add Account</p>
              <p className="text-xs text-muted-foreground">Manage multiple accounts</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          <Separator />

          {/* Delete Account */}
          <button
            onClick={() => setSection('delete')}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-destructive/10 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-destructive">Delete Account</p>
              <p className="text-xs text-muted-foreground">Permanently remove your account</p>
            </div>
          </button>

          <Separator />

          <Button
            variant="ghost"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
      </div>

      <AccountSwitcher open={showAccountSwitcher} onOpenChange={setShowAccountSwitcher} />
      <AvatarCropDialog
        open={showCropDialog}
        onOpenChange={setShowCropDialog}
        imageFile={cropFile}
        onCropComplete={handleCroppedAvatar}
        saving={savingAvatar}
      />
    </MainLayout>
  );
}
