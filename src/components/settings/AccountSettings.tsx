import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertDialog, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft, User, Mail, Shield, Key, Calendar, Users2,
  Trash2, Loader2, Clock, AlertTriangle, ChevronRight, Lock, Radio, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

interface AccountSettingsProps {
  onBack: () => void;
  onShowPrivacy?: () => void;
  onShowVerification?: () => void;
  onShowBroadcast?: () => void;
}

export function AccountSettings({ onBack, onShowPrivacy, onShowVerification, onShowBroadcast }: AccountSettingsProps) {
  const { user, profile, signOut, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setDateOfBirth((profile as any).date_of_birth || '');
      setGender((profile as any).gender || '');
    }
  }, [profile]);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast.success('Password updated successfully');
      setShowPasswordDialog(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }

    setChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      
      toast.success('Verification email sent! Please check your inbox.');
      setShowEmailDialog(false);
      setNewEmail('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update email');
    } finally {
      setChangingEmail(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Profile updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !deletePassword) return;
    
    setDeleting(true);
    try {
      // Re-authenticate with password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: deletePassword,
      });

      if (authError) {
        toast.error('Incorrect password');
        setDeleting(false);
        return;
      }

      // Delete user's data
      await supabase.from('posts').delete().eq('user_id', user.id);
      await supabase.from('comments').delete().eq('user_id', user.id);
      await supabase.from('likes').delete().eq('user_id', user.id);
      await supabase.from('saves').delete().eq('user_id', user.id);
      await supabase.from('follows').delete().or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);
      await supabase.from('messages').delete().eq('sender_id', user.id);
      await supabase.from('conversation_participants').delete().eq('user_id', user.id);
      await supabase.from('stories').delete().eq('user_id', user.id);
      await supabase.from('reels').delete().eq('user_id', user.id);
      await supabase.from('notifications').delete().or(`user_id.eq.${user.id},actor_id.eq.${user.id}`);
      await supabase.from('profiles').delete().eq('id', user.id);

      await signOut();
      toast.success('Account deleted successfully');
      navigate('/auth');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (!user) return null;

  const accountType = (profile as any)?.account_type || 'personal';

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">Account</h1>
      </header>

      {/* Account Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Account Information
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">User ID</p>
                <p className="font-mono text-xs">{user.id.slice(0, 8)}...{user.id.slice(-4)}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowEmailDialog(true)}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div className="text-left">
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Account Type</p>
                <p className="font-medium capitalize">{accountType}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <Separator />

      {/* Personal Information */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="space-y-4"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Personal Information
        </h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date-of-birth" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date of Birth
            </Label>
            <Input
              id="date-of-birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender" className="flex items-center gap-2">
              <Users2 className="w-4 h-4" />
              Gender
            </Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="non-binary">Non-binary</SelectItem>
                <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
            {savingProfile ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </motion.div>

      <Separator />

      {/* Quick Access */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Settings
        </h2>

        <div className="space-y-2">
          {onShowPrivacy && (
            <button
              onClick={onShowPrivacy}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-muted-foreground" />
                <span>Privacy</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          
          {onShowVerification && (
            <button
              onClick={onShowVerification}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <span>Verification Requests</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          
          {onShowBroadcast && (
            <button
              onClick={onShowBroadcast}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <Radio className="w-5 h-5 text-muted-foreground" />
                <span>Broadcast Channels</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </motion.div>

      <Separator />

      {/* Security */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-4"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Security
        </h2>

        <Button
          variant="outline"
          className="w-full justify-start gap-3"
          onClick={() => setShowPasswordDialog(true)}
        >
          <Key className="w-5 h-5" />
          Change Password
        </Button>
      </motion.div>

      <Separator />

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <h2 className="text-sm font-medium text-destructive uppercase tracking-wide flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Danger Zone
        </h2>

        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Once you delete your account, there is no going back. All your data will be permanently removed.
          </p>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Account
          </Button>
        </div>
      </motion.div>

      {/* Change Email Dialog */}
      <AlertDialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Email</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your new email address. You'll receive a verification email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">Current Email</Label>
              <Input
                id="current-email"
                value={user.email || ''}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="newemail@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleChangeEmail} disabled={changingEmail}>
              {changingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Update Email'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Password Dialog */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Password</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your new password below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account and remove all your data including posts, messages, followers, and more.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="delete-password">Enter your password to confirm</Label>
              <Input
                id="delete-password"
                type="password"
                placeholder="Your password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount}
              disabled={deleting || !deletePassword}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
