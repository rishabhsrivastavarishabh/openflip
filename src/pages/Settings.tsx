import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Lock, Bell, HelpCircle, LogOut, Camera } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: profile?.username || '',
    full_name: profile?.full_name || '',
    bio: profile?.bio || '',
    website: profile?.website || '',
  });

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

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
            <button className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-left">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <span>Privacy</span>
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
