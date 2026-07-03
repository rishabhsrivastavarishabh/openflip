import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarCropDialog } from '@/components/settings/AvatarCropDialog';
import { Camera, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountPage() {
  const { user, profile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingCover, setSavingCover] = useState(false);

  const [form, setForm] = useState({
    username: profile?.username || '',
    full_name: profile?.full_name || '',
    bio: profile?.bio || '',
    website: profile?.website || '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        username: profile.username || '',
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        website: profile.website || '',
      });
    }
  }, [profile]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleCropped = async (blob: Blob) => {
    if (!user) return;
    setSavingAvatar(true);
    try {
      const fileName = `${user.id}/avatar.png`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, blob, { upsert: true, contentType: 'image/png' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
      await updateProfile({ avatar_url: `${publicUrl}?t=${Date.now()}` });
      toast.success('Avatar updated');
      setShowCropDialog(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update avatar');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    const { error } = await updateProfile({
      username: form.username,
      full_name: form.full_name || null,
      bio: form.bio || null,
      website: form.website || null,
    });
    setLoading(false);
    if (error) toast.error(error.message || 'Failed to update profile');
    else toast.success('Profile updated');
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold mb-1">Account</h2>
        <p className="text-sm text-muted-foreground">Update your profile and account details.</p>
      </section>

      <section className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="w-20 h-20">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>{profile?.username?.charAt(0).toUpperCase() ?? '?'}</AvatarFallback>
          </Avatar>
          <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer hover:opacity-90">
            <Camera className="w-3.5 h-3.5" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </div>
        <div>
          <div className="font-medium">{profile?.username}</div>
          <div className="text-sm text-muted-foreground">{user?.email}</div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
        </div>
        <div>
          <Label htmlFor="website">Website</Label>
          <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </div>
        <div>
          <Label>Email</Label>
          <Input value={user?.email ?? ''} disabled />
          <p className="text-xs text-muted-foreground mt-1">
            To change your email, contact support.
          </p>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save changes'}
        </Button>
      </section>

      <AvatarCropDialog
        open={showCropDialog}
        onOpenChange={setShowCropDialog}
        imageFile={cropFile}
        onCropComplete={handleCropped}
        saving={savingAvatar}
      />

    </div>
  );
}
