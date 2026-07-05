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

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Cover image must be under 8MB');
      return;
    }
    setSavingCover(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/cover.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
      await updateProfile({ cover_url: `${publicUrl}?t=${Date.now()}` } as any);
      toast.success('Cover updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update cover');
    } finally {
      setSavingCover(false);
    }
  };

  const handleRemoveCover = async () => {
    if (!user) return;
    setSavingCover(true);
    try {
      // Null out the cover directly in the DB — bypass the context helper so we
      // can inspect the exact response instead of losing errors to a silent
      // Partial<Profile> cast.
      const { error } = await supabase
        .from('profiles')
        .update({ cover_url: null })
        .eq('id', user.id);
      if (error) throw error;

      // Best-effort cleanup of stored cover files; ignore permission errors.
      try {
        const { data: files } = await supabase.storage.from('media').list(user.id, { limit: 20 });
        const coverFiles = (files || [])
          .filter((f) => f.name.startsWith('cover.'))
          .map((f) => `${user.id}/${f.name}`);
        if (coverFiles.length > 0) {
          await supabase.storage.from('media').remove(coverFiles);
        }
      } catch (storageErr) {
        console.warn('Cover storage cleanup skipped:', storageErr);
      }

      // Sync local profile state via the context helper so the header/preview
      // re-render immediately without waiting for the next auth event.
      await updateProfile({ cover_url: null } as any);
      toast.success('Cover removed');
    } catch (err: any) {
      console.error('Remove cover failed', err);
      toast.error(err?.message || 'Failed to remove cover');
    } finally {
      setSavingCover(false);
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

      <section>
        <Label className="mb-2 block">Cover picture</Label>
        <div
          className="relative w-full h-40 rounded-2xl overflow-hidden bg-gradient-to-r from-primary/20 to-primary/10 border border-border/50"
          style={(profile as any)?.cover_url ? { backgroundImage: `url(${(profile as any).cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute bottom-3 right-3 flex gap-2">
            {(profile as any)?.cover_url && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRemoveCover}
                disabled={savingCover}
              >
                <X className="w-4 h-4 mr-1" /> Remove
              </Button>
            )}
            <label>
              <Button asChild size="sm" disabled={savingCover}>
                <span className="cursor-pointer">
                  <ImagePlus className="w-4 h-4 mr-1" />
                  {savingCover ? 'Uploading…' : ((profile as any)?.cover_url ? 'Change cover' : 'Add cover')}
                </span>
              </Button>
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            </label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Recommended 1500×500. Max 8MB.</p>
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
