import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, User, Lock, Bell, HelpCircle, LogOut, Camera, ChevronRight, Shield, Ban, Trash2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
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

export default function SettingsPage() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
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

    setLoading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      await updateProfile({ avatar_url: publicUrl });
      toast.success('Avatar updated!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update avatar');
    } finally {
      setLoading(false);
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

          {/* Other Settings */}
          <div className="space-y-2">
            <button
              onClick={() => setShowPrivacy(true)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <span>Privacy</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isPrivate ? 'Private' : 'Public'}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span>Notifications</span>
            </button>
            <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              <span>Help</span>
            </button>
          </div>

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
    </MainLayout>
  );
}
