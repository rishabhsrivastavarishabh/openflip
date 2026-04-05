import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, User, Lock, Bell, HelpCircle, LogOut, Camera, ChevronRight,
  Shield, Ban, Trash2, Briefcase, Settings2, Crown, BarChart3, Tag, Moon,
  Sun, Monitor, Users, Eye, Heart, MessageCircle, Smartphone, Image,
  Globe, UserCheck, Volume2, Palette, Info, FileText, Phone
} from 'lucide-react';
import { AvatarCropDialog } from '@/components/settings/AvatarCropDialog';
import { MainLayout } from '@/components/layout/MainLayout';
import { BusinessAccountSettings } from '@/components/settings/BusinessAccountSettings';
import { AccountSwitcher } from '@/components/account/AccountSwitcher';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { VerificationPanel } from '@/components/admin/VerificationPanel';
import { BusinessVerificationFlow } from '@/components/verification/BusinessVerificationFlow';
import { SubscriptionSettings } from '@/components/subscription/SubscriptionSettings';
import { CreatorDashboard } from '@/components/creator/CreatorDashboard';
import { CreatorEarnings } from '@/components/creator/CreatorEarnings';
import { ContentManager } from '@/components/creator/ContentManager';
import { AIGrowthAssistant } from '@/components/creator/AIGrowthAssistant';
import { AudienceInsights } from '@/components/creator/AudienceInsights';
import { BoostCampaign } from '@/components/creator/BoostCampaign';
import { ContentCalendar } from '@/components/creator/ContentCalendar';
import { FanSubscriptions } from '@/components/creator/FanSubscriptions';
import { AdminPromoManager } from '@/components/admin/AdminPromoManager';
import { DevicePermissions } from '@/components/settings/DevicePermissions';
import { MediaQualitySettings } from '@/components/settings/MediaQualitySettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';

interface SettingsSection {
  title: string;
  items: {
    icon: any;
    label: string;
    description?: string;
    action: () => void;
    badge?: string;
    highlight?: boolean;
  }[];
}

export default function SettingsPage() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showBusinessSettings, setShowBusinessSettings] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showVerificationPanel, setShowVerificationPanel] = useState(false);
  const [showSubscriptionSettings, setShowSubscriptionSettings] = useState(false);
  const [showCreatorTools, setShowCreatorTools] = useState(false);
  const [creatorSection, setCreatorSection] = useState<string | null>(null);
  const [showPromoManager, setShowPromoManager] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFamilyCentre, setShowFamilyCentre] = useState(false);
  const [showVerificationFlow, setShowVerificationFlow] = useState(false);
  const [showDevicePermissions, setShowDevicePermissions] = useState(false);
  const [showMediaQuality, setShowMediaQuality] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPrivate, setIsPrivate] = useState(profile?.is_private || false);
  const [formData, setFormData] = useState({
    username: profile?.username || '',
    full_name: profile?.full_name || '',
    bio: profile?.bio || '',
    website: profile?.website || '',
  });

  useEffect(() => {
    if (profile) {
      setIsPrivate(profile.is_private || false);
      setFormData({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        website: profile.website || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle()
        .then(({ data }) => setIsAdmin(!!data));
    }
  }, [user]);

  useEffect(() => {
    const subscriptionStatus = searchParams.get('subscription');
    if (subscriptionStatus === 'success') {
      toast.success('Subscription activated! Welcome to Openflip Verified.');
      setShowSubscriptionSettings(true);
    } else if (subscriptionStatus === 'cancelled') {
      toast.info('Checkout cancelled');
    }
  }, [searchParams]);

  useEffect(() => {
    if (showBlockedUsers) {
      fetchBlockedUsers();
    }
  }, [showBlockedUsers]);

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setCropFile(file);
    setShowCropDialog(true);
    e.target.value = '';
  };

  const handleCroppedAvatar = async (blob: Blob) => {
    setSavingAvatar(true);
    try {
      const fileName = `${user.id}/avatar.png`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, blob, { upsert: true, contentType: 'image/png' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);
      await updateProfile({ avatar_url: `${publicUrl}?t=${Date.now()}` });
      toast.success('Avatar updated!');
      setShowCropDialog(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update avatar');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await updateProfile({
      username: formData.username,
      full_name: formData.full_name || null,
      bio: formData.bio || null,
      website: formData.website || null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Failed to update profile');
    } else {
      toast.success('Profile updated!');
    }
  };

  const handlePrivacyToggle = async (checked: boolean) => {
    setIsPrivate(checked);
    setLoading(true);
    const { error } = await updateProfile({ is_private: checked });
    setLoading(false);
    if (error) {
      setIsPrivate(!checked);
      toast.error('Failed to update privacy setting');
    } else {
      toast.success(checked ? 'Your account is now private' : 'Your account is now public');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const fetchBlockedUsers = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from('blocked_users')
      .select('id, blocked_id, created_at')
      .eq('blocker_id', user.id);
    if (data) {
      const blockedIds = data.map((b: any) => b.blocked_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', blockedIds);
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setBlockedUsers(data.map((b: any) => ({
        ...b,
        profile: profilesMap.get(b.blocked_id),
      })));
    }
  };

  const handleUnblock = async (blockedId: string) => {
    if (!user) return;
    await (supabase as any)
      .from('blocked_users')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedId);
    setBlockedUsers(prev => prev.filter(b => b.blocked_id !== blockedId));
    toast.success('User unblocked');
  };

  // ─── Sub-page renders ───

  if (showBlockedUsers) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setShowBlockedUsers(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Blocked Users</h1>
            </div>
          </header>
          <div className="p-4 space-y-2">
            {blockedUsers.length === 0 ? (
              <div className="text-center py-12">
                <Ban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No blocked users</p>
              </div>
            ) : blockedUsers.map((blocked) => (
              <div key={blocked.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={blocked.profile?.avatar_url} />
                    <AvatarFallback>{blocked.profile?.username?.charAt(0).toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{blocked.profile?.username || 'Unknown'}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleUnblock(blocked.blocked_id)}>
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  if (showAccountSettings) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <AccountSettings
            onBack={() => setShowAccountSettings(false)}
            onShowPrivacy={() => { setShowAccountSettings(false); setShowPrivacy(true); }}
            onShowVerification={isAdmin ? () => { setShowAccountSettings(false); setShowVerificationPanel(true); } : undefined}
            onShowBusiness={() => { setShowAccountSettings(false); setShowBusinessSettings(true); }}
          />
        </div>
      </MainLayout>
    );
  }

  if (showNotificationSettings) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <NotificationSettings onBack={() => setShowNotificationSettings(false)} />
        </div>
      </MainLayout>
    );
  }

  if (showBusinessSettings) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <BusinessAccountSettings onBack={() => setShowBusinessSettings(false)} />
        </div>
      </MainLayout>
    );
  }

  if (showSubscriptionSettings) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <SubscriptionSettings onBack={() => setShowSubscriptionSettings(false)} />
        </div>
      </MainLayout>
    );
  }

  // Creator Tools sub-sections
  if (showCreatorTools && creatorSection === 'earnings') {
    return <MainLayout><div className="max-w-lg mx-auto p-4"><CreatorEarnings onBack={() => setCreatorSection(null)} /></div></MainLayout>;
  }
  if (showCreatorTools && creatorSection === 'ai-assistant') {
    return <MainLayout><div className="max-w-lg mx-auto p-4"><AIGrowthAssistant onBack={() => setCreatorSection(null)} /></div></MainLayout>;
  }
  if (showCreatorTools && creatorSection === 'audience') {
    return <MainLayout><div className="max-w-lg mx-auto p-4"><AudienceInsights onBack={() => setCreatorSection(null)} /></div></MainLayout>;
  }
  if (showCreatorTools && creatorSection === 'manager') {
    return <MainLayout><div className="max-w-lg mx-auto p-4"><ContentManager onBack={() => setCreatorSection(null)} onBoost={() => setCreatorSection('boost')} /></div></MainLayout>;
  }
  if (showCreatorTools && creatorSection === 'boost') {
    return <MainLayout><div className="max-w-lg mx-auto p-4"><BoostCampaign onBack={() => setCreatorSection(null)} /></div></MainLayout>;
  }
  if (showCreatorTools && creatorSection === 'calendar') {
    return <MainLayout><div className="max-w-lg mx-auto p-4"><ContentCalendar onBack={() => setCreatorSection(null)} /></div></MainLayout>;
  }
  if (showCreatorTools && creatorSection === 'fan-subs') {
    return <MainLayout><div className="max-w-lg mx-auto p-4"><FanSubscriptions onBack={() => setCreatorSection(null)} /></div></MainLayout>;
  }
  if (showCreatorTools) {
    return <MainLayout><div className="max-w-lg mx-auto p-4"><CreatorDashboard onBack={() => setShowCreatorTools(false)} onOpenSection={(section) => setCreatorSection(section)} /></div></MainLayout>;
  }
  if (showPromoManager) {
    return <MainLayout><div className="max-w-lg mx-auto p-4"><AdminPromoManager onBack={() => setShowPromoManager(false)} /></div></MainLayout>;
  }
  if (showVerificationFlow) {
    return <MainLayout><div className="max-w-lg mx-auto p-4"><BusinessVerificationFlow onBack={() => setShowVerificationFlow(false)} /></div></MainLayout>;
  }

  // Privacy page
  if (showPrivacy) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setShowPrivacy(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Privacy</h1>
            </div>
          </header>
          <div className="p-4 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Private Account</p>
                    <p className="text-sm text-muted-foreground">Only approved followers can see your posts</p>
                  </div>
                </div>
                <Switch checked={isPrivate} onCheckedChange={handlePrivacyToggle} disabled={loading} />
              </div>
              {isPrivate && (
                <div className="p-4 rounded-xl bg-muted/50 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-medium">What happens when your account is private:</span>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                    <li>New followers must send a request</li>
                    <li>You can approve or reject requests</li>
                    <li>Only approved followers see your posts</li>
                    <li>Your profile info is still visible to everyone</li>
                  </ul>
                </div>
              )}
            </div>
            <Separator />
            <Button variant="outline" className="w-full justify-between" onClick={() => navigate(`/profile/${user.id}/followers`)}>
              <span>Manage Followers</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between" onClick={() => setShowBlockedUsers(true)}>
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4" />
                <span>Blocked Users</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Edit profile page
  if (showEditProfile) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setShowEditProfile(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Edit Profile</h1>
            </div>
          </header>
          <div className="p-4 space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
                  <Camera className="h-4 w-4" />
                  <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </label>
              </div>
              <div>
                <p className="font-semibold">{profile?.username}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className="resize-none" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://" />
              </div>
              <Button variant="gradient" onClick={handleSave} disabled={loading} className="w-full">
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
        <AvatarCropDialog open={showCropDialog} onOpenChange={setShowCropDialog} imageFile={cropFile} onCropComplete={handleCroppedAvatar} saving={savingAvatar} />
      </MainLayout>
    );
  }

  // Appearance page
  if (showAppearance) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setShowAppearance(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Appearance</h1>
            </div>
          </header>
          <div className="p-4 space-y-6">
            <h2 className="font-semibold">Theme</h2>
            <div className="flex gap-2">
              {([
                { value: 'light' as const, icon: Sun, label: 'Light' },
                { value: 'dark' as const, icon: Moon, label: 'Dark' },
                { value: 'system' as const, icon: Monitor, label: 'Auto' },
              ]).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-colors ${
                    theme === value ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-secondary border-border'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Auto mode follows your device's system theme.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Help page
  if (showHelp) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setShowHelp(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Help & Support</h1>
            </div>
          </header>
          <div className="p-4 space-y-4">
            {[
              { icon: User, label: 'Account', desc: 'Profile, login, account settings' },
              { icon: Lock, label: 'Privacy & Security', desc: 'Password, two-factor, data' },
              { icon: Crown, label: 'Payments & Subscriptions', desc: 'Billing, plans, invoices' },
              { icon: Shield, label: 'Reporting & Safety', desc: 'Block, report, content moderation' },
              { icon: Info, label: 'About Openflip', desc: 'Version, policies, terms' },
            ].map((item) => (
              <button key={item.label} className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors text-left">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </button>
            ))}
            <Separator />
            <div className="text-center space-y-2 py-4">
              <Link to="/privacy" className="text-sm text-primary hover:underline block">Privacy Policy</Link>
              <Link to="/terms" className="text-sm text-primary hover:underline block">Terms of Service</Link>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Family Centre
  if (showFamilyCentre) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto">
          <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setShowFamilyCentre(false)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="font-semibold text-lg">Family Centre</h1>
            </div>
          </header>
          <div className="p-4 space-y-4">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <h3 className="font-semibold mb-2">Supervision Tools</h3>
              <p className="text-sm text-muted-foreground">
                Family Centre helps parents and guardians understand and manage their teen's Openflip experience.
              </p>
            </div>
            {[
              { icon: Eye, label: 'Content Restrictions', desc: 'Control what content can be viewed' },
              { icon: MessageCircle, label: 'Interaction Limits', desc: 'Manage who can message and interact' },
              { icon: Shield, label: 'Privacy Guidance', desc: 'Learn about privacy controls' },
              { icon: Bell, label: 'Activity Reports', desc: 'View time spent and activity summary' },
            ].map((item) => (
              <button key={item.label} className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors text-left">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  // ─── Instagram-style grouped settings ───

  const settingsSections: SettingsSection[] = [
    {
      title: 'How you use Openflip',
      items: [
        { icon: User, label: 'Edit profile', action: () => setShowEditProfile(true) },
        { icon: Bell, label: 'Notifications', action: () => setShowNotificationSettings(true) },
        { icon: Palette, label: 'Appearance', action: () => setShowAppearance(true) },
      ],
    },
    {
      title: 'For professionals',
      items: [
        { icon: BarChart3, label: 'Creator Tools', description: 'Analytics, insights & growth', action: () => setShowCreatorTools(true), highlight: true },
        { icon: Crown, label: 'Verification & Subscription', description: profile?.is_verified ? '✓ Verified' : 'Get verified', action: () => setShowSubscriptionSettings(true), highlight: true },
        { icon: Shield, label: 'Business Verification', description: 'Verify with government ID', action: () => setShowVerificationFlow(true) },
        { icon: Briefcase, label: 'Business Account', description: 'Switch to business or creator', action: () => setShowBusinessSettings(true) },
        ...(isAdmin ? [{ icon: Tag, label: 'Promo Codes', description: 'Manage discount codes', action: () => setShowPromoManager(true) }] : []),
      ],
    },
    {
      title: 'Who can see your content',
      items: [
        { icon: Lock, label: 'Account Privacy', description: isPrivate ? 'Private account' : 'Public account', action: () => setShowPrivacy(true) },
        { icon: Ban, label: 'Blocked Users', action: () => setShowBlockedUsers(true) },
      ],
    },
    {
      title: 'How others can interact with you',
      items: [
        { icon: MessageCircle, label: 'Messages', description: 'Who can message you', action: () => setShowNotificationSettings(true) },
        { icon: UserCheck, label: 'Follow Requests', action: () => navigate(`/profile/${user.id}/followers`) },
      ],
    },
    {
      title: 'Your app & media',
      items: [
        { icon: Smartphone, label: 'Device Permissions', description: 'Camera, microphone, storage', action: () => {} },
        { icon: Image, label: 'Media Quality', description: 'Upload & download quality', action: () => {} },
      ],
    },
    {
      title: 'Family Centre',
      items: [
        { icon: Users, label: 'Supervision Tools', description: 'Content & interaction controls', action: () => setShowFamilyCentre(true) },
      ],
    },
    {
      title: 'More info & support',
      items: [
        { icon: HelpCircle, label: 'Help', action: () => setShowHelp(true) },
        { icon: Info, label: 'About', description: 'Privacy Policy, Terms of Service', action: () => setShowHelp(true) },
        { icon: Settings2, label: 'Account Centre', description: 'Profile, security, payments', action: () => navigate('/account-center') },
      ],
    },
  ];

  return (
    <MainLayout>
      <div className="max-w-lg mx-auto">
        <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-lg">Settings</h1>
          </div>
        </header>

        <div className="p-4 space-y-6">
          {/* Profile summary card */}
          <button
            onClick={() => setShowEditProfile(true)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-secondary/50 hover:bg-secondary transition-colors text-left"
          >
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {profile?.username?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate">{profile?.username}</p>
              <p className="text-sm text-muted-foreground truncate">{profile?.full_name || user.email}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </button>

          {/* Account switcher */}
          <button
            onClick={() => setShowAccountSwitcher(true)}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left"
          >
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Switch Account</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
          </button>

          {/* Grouped sections */}
          {settingsSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
                {section.title}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left ${
                      item.highlight ? 'bg-primary/5' : ''
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${item.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{item.label}</span>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}

          <Separator />

          <Button
            variant="ghost"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <AccountSwitcher open={showAccountSwitcher} onOpenChange={setShowAccountSwitcher} />
      <VerificationPanel open={showVerificationPanel} onOpenChange={setShowVerificationPanel} />
      <AvatarCropDialog open={showCropDialog} onOpenChange={setShowCropDialog} imageFile={cropFile} onCropComplete={handleCroppedAvatar} saving={savingAvatar} />
    </MainLayout>
  );
}
