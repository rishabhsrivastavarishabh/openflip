import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Bell, MessageCircle, Heart, MessageSquare, UserPlus, Volume2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface NotificationSettingsProps {
  onBack: () => void;
}

interface NotificationPreferences {
  chat_notifications: boolean;
  story_like_notifications: boolean;
  comment_notifications: boolean;
  follow_notifications: boolean;
  notification_sound: boolean;
  ringtone: string;
  message_ringtone: string;
}

export function NotificationSettings({ onBack }: NotificationSettingsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationPreferences>({
    chat_notifications: true,
    story_like_notifications: true,
    comment_notifications: true,
    follow_notifications: true,
    notification_sound: true,
    ringtone: 'default',
    message_ringtone: 'chime',
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          chat_notifications: data.chat_notifications ?? true,
          story_like_notifications: data.story_like_notifications ?? true,
          comment_notifications: data.comment_notifications ?? true,
          follow_notifications: data.follow_notifications ?? true,
          notification_sound: data.notification_sound ?? true,
          ringtone: data.ringtone ?? 'default',
          message_ringtone: (data as any).message_ringtone ?? 'chime',
        });
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          ...newSettings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Settings saved');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setSettings({ ...settings, [key]: !value });
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRingtoneChange = async (value: string) => {
    if (!user) return;
    
    const newSettings = { ...settings, ringtone: value };
    setSettings(newSettings);
    
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          ...newSettings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Ringtone updated');
    } catch (error) {
      console.error('Error saving ringtone:', error);
      toast.error('Failed to update ringtone');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-lg">Notifications</h1>
        {saving && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
      </header>

      {/* Push Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Push Notifications
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="chat-notifications" className="font-medium cursor-pointer">Chat Messages</Label>
                <p className="text-sm text-muted-foreground">Get notified for new messages</p>
              </div>
            </div>
            <Switch
              id="chat-notifications"
              checked={settings.chat_notifications}
              onCheckedChange={(checked) => handleToggle('chat_notifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="story-likes" className="font-medium cursor-pointer">Story Likes</Label>
                <p className="text-sm text-muted-foreground">Get notified when someone likes your story</p>
              </div>
            </div>
            <Switch
              id="story-likes"
              checked={settings.story_like_notifications}
              onCheckedChange={(checked) => handleToggle('story_like_notifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="comments" className="font-medium cursor-pointer">Comments</Label>
                <p className="text-sm text-muted-foreground">Get notified for new comments on your posts</p>
              </div>
            </div>
            <Switch
              id="comments"
              checked={settings.comment_notifications}
              onCheckedChange={(checked) => handleToggle('comment_notifications', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <UserPlus className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="follows" className="font-medium cursor-pointer">New Followers</Label>
                <p className="text-sm text-muted-foreground">Get notified when someone follows you</p>
              </div>
            </div>
            <Switch
              id="follows"
              checked={settings.follow_notifications}
              onCheckedChange={(checked) => handleToggle('follow_notifications', checked)}
            />
          </div>
        </div>
      </motion.div>

      <Separator />

      {/* Sound Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Sound & Ringtone
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <Volume2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label htmlFor="notification-sound" className="font-medium cursor-pointer">Notification Sound</Label>
                <p className="text-sm text-muted-foreground">Play sound for notifications</p>
              </div>
            </div>
            <Switch
              id="notification-sound"
              checked={settings.notification_sound}
              onCheckedChange={(checked) => handleToggle('notification_sound', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label className="font-medium">Notification sound</Label>
                <p className="text-sm text-muted-foreground">For likes, comments and follows</p>
              </div>
            </div>
            <Select value={settings.ringtone} onValueChange={handleRingtoneChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="chime">Chime</SelectItem>
                <SelectItem value="ding">Ding</SelectItem>
                <SelectItem value="pop">Pop</SelectItem>
                <SelectItem value="swoosh">Swoosh</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
              <div>
                <Label className="font-medium">Message ringtone</Label>
                <p className="text-sm text-muted-foreground">Sound played for new chat messages</p>
              </div>
            </div>
            <Select
              value={settings.message_ringtone}
              onValueChange={async (value) => {
                if (!user) return;
                const next = { ...settings, message_ringtone: value };
                setSettings(next);
                setSaving(true);
                const { error } = await (supabase as any)
                  .from('notification_settings')
                  .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
                setSaving(false);
                if (error) toast.error('Failed to update message ringtone');
                else toast.success('Message ringtone updated');
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chime">Chime</SelectItem>
                <SelectItem value="ding">Ding</SelectItem>
                <SelectItem value="pop">Pop</SelectItem>
                <SelectItem value="bubble">Bubble</SelectItem>
                <SelectItem value="soft">Soft</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
      </motion.div>
    </div>
  );
}