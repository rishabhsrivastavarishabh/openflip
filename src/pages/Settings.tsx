import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, Lock, Bell, HelpCircle, LogOut, Camera, ChevronRight, Shield, Ban, Trash2, Briefcase, Settings2, Crown, BarChart3, Tag, Moon, Sun, Monitor, Users } from 'lucide-react';
import { AvatarCropDialog } from '@/components/settings/AvatarCropDialog';
import { MainLayout } from '@/components/layout/MainLayout';
import { BusinessAccountSettings } from '@/components/settings/BusinessAccountSettings';
import { AccountSwitcher } from '@/components/account/AccountSwitcher';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { VerificationPanel } from '@/components/admin/VerificationPanel';
import { SubscriptionSettings } from '@/components/subscription/SubscriptionSettings';
import { CreatorDashboard } from '@/components/creator/CreatorDashboard';
import { CreatorEarnings } from '@/components/creator/CreatorEarnings';
import { ContentManager } from '@/components/creator/ContentManager';
import { AudienceInsights } from '@/components/creator/AudienceInsights';
import { BoostCampaign } from '@/components/creator/BoostCampaign';
import { AdminPromoManager } from '@/components/admin/AdminPromoManager';
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

  // Handle subscription success/cancelled params
  useEffect(() => {
    const subscriptionStatus = searchParams.get('subscription');
    if (subscriptionStatus === 'success') {
      toast.success('Subscription activated! Welcome to Openflip Verified.');
      setShowSubscriptionSettings(true);
    } else if (subscriptionStatus === 'cancelled') {
      toast.info('Checkout cancelled');
    }
  }, [searchParams]);

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
    // Reset input so re-selecting the same file works
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
      .select(`
        id,
        blocked_id,
        created_at
      `)
      .eq('blocker_id', user.id);

    if (data) {
      // Fetch profiles for blocked users
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

  useEffect(() => {
    if (showBlockedUsers) {
      fetchBlockedUsers();
    }
  }, [showBlockedUsers]);

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
            ) : (
              blockedUsers.map((blocked) => (
                <div
                  key={blocked.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={blocked.profile?.avatar_url} />
                      <AvatarFallback>
                        {blocked.profile?.username?.charAt(0).toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{blocked.profile?.username || 'Unknown'}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnblock(blocked.blocked_id)}
                  >
                    Unblock
                  </Button>
                </div>
              ))
            )}
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
            onShowPrivacy={() => {
              setShowAccountSettings(false);
              setShowPrivacy(true);
            }}
            onShowVerification={isAdmin ? () => {
              setShowAccountSettings(false);
              setShowVerificationPanel(true);
            } : undefined}
            onShowBusiness={() => {
              setShowAccountSettings(false);
              setShowBusinessSettings(true);
            }}
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

  // Creator Tools sections
  if (showCreatorTools && creatorSection === 'earnings') {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <CreatorEarnings onBack={() => setCreatorSection(null)} />
        </div>
      </MainLayout>
    );
  }

  if (showCreatorTools && creatorSection === 'audience') {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <AudienceInsights onBack={() => setCreatorSection(null)} />
        </div>
      </MainLayout>
    );
  }

  if (showCreatorTools && creatorSection === 'manager') {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <ContentManager 
            onBack={() => setCreatorSection(null)} 
            onBoost={(type, id) => {
              setCreatorSection('boost');
            }}
          />
        </div>
      </MainLayout>
    );
  }

  if (showCreatorTools && creatorSection === 'boost') {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <BoostCampaign onBack={() => setCreatorSection(null)} />
        </div>
      </MainLayout>
    );
  }

  if (showCreatorTools) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <CreatorDashboard 
            onBack={() => setShowCreatorTools(false)} 
            onOpenSection={(section) => setCreatorSection(section)}
          />
        </div>
      </MainLayout>
    );
  }

  if (showPromoManager) {
    return (
      <MainLayout>
        <div className="max-w-lg mx-auto p-4">
          <AdminPromoManager onBack={() => setShowPromoManager(false)} />
        </div>
      </MainLayout>
    );
  }

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
                    <p className="text-sm text-muted-foreground">
                      Only approved followers can see your posts
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isPrivate}
                  onCheckedChange={handlePrivacyToggle}
                  disabled={loading}
                />
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

              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => navigate(`/profile/${user.id}/followers`)}
              >
                <span>Manage Followers</span>
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setShowBlockedUsers(true)}
              >
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
          {/* Avatar */}
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
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            </div>
            <div>
              <p className="font-semibold">{profile?.username}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Separator />

          {/* Edit Profile */}
          <div className="space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Edit Profile
            </h2>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://"
              />
            </div>

            <Button variant="gradient" onClick={handleSave} disabled={loading} className="w-full">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          <Separator />

          {/* Theme / Dark Mode */}
          <div className="space-y-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Appearance</h2>
            <div className="flex gap-2">
              {([
                { value: 'light' as const, icon: Sun, label: 'Light' },
                { value: 'dark' as const, icon: Moon, label: 'Dark' },
                { value: 'system' as const, icon: Monitor, label: 'Auto' },
              ]).map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                    theme === value ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-secondary border-border'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Other Settings */}
          <div className="space-y-2">
            <button
              onClick={() => setShowSubscriptionSettings(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors text-left bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/20"
            >
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary" />
                <div>
                  <span className="font-medium">Verification & Subscription</span>
                  {profile?.is_verified && (
                    <span className="ml-2 text-xs text-primary">✓ Verified</span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            
            {/* Creator Tools - show for all verified users */}
            <button
              onClick={() => setShowCreatorTools(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors text-left bg-gradient-to-r from-blue-500/5 to-green-500/5 border border-blue-500/20"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <div>
                  <span className="font-medium">Creator Tools</span>
                  <p className="text-xs text-muted-foreground">Analytics & Insights</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            
            {/* Admin: Promo Code Manager */}
            {isAdmin && (
              <button
                onClick={() => setShowPromoManager(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors text-left bg-gradient-to-r from-yellow-500/5 to-orange-500/5 border border-yellow-500/20"
              >
                <div className="flex items-center gap-3">
                  <Tag className="h-5 w-5 text-yellow-600" />
                  <div>
                    <span className="font-medium">Promo Codes</span>
                    <p className="text-xs text-muted-foreground">Manage discount codes</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            
            <button
              onClick={() => setShowNotificationSettings(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span>Notifications</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowAccountSettings(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Settings2 className="h-5 w-5 text-muted-foreground" />
                <span>Account</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              <span>Help</span>
            </button>
          </div>

          <VerificationPanel open={showVerificationPanel} onOpenChange={setShowVerificationPanel} />

          <Separator />

          {/* Legal */}
          <div className="space-y-2">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Legal</h2>
            <Link
              to="/privacy"
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors"
            >
              <span>Privacy Policy</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/terms"
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors"
            >
              <span>Terms of Service</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>

          <Separator />

          {/* Account Switching */}
          <div className="space-y-2">
            <button
              onClick={() => setShowAccountSwitcher(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span>Switch Account</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

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
