import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Phone, Video, Vibrate, Volume2, Music, Bell, Play, UserX, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  RINGTONES, CALLER_TUNES, playPattern, type ToneHandle,
} from '@/lib/callSounds';

interface CallPreferences {
  call_notifications: boolean;
  video_call_notifications: boolean;
  call_vibrate: boolean;
  call_ringtone: string;
  caller_tune: string;
  caller_tune_enabled: boolean;
  speaker_default_on: boolean;
  allow_unknown_callers: boolean;
}

const DEFAULTS: CallPreferences = {
  call_notifications: true,
  video_call_notifications: true,
  call_vibrate: true,
  call_ringtone: 'default',
  caller_tune: 'default',
  caller_tune_enabled: true,
  speaker_default_on: false,
  allow_unknown_callers: true,
};

const RINGTONE_LABELS: Record<string, string> = {
  default: 'Default', chime: 'Chime', ding: 'Ding', pop: 'Pop',
  swoosh: 'Swoosh', classic: 'Classic', none: 'None',
};
const TUNE_LABELS: Record<string, string> = {
  default: 'Dial tone', soft: 'Soft', uplift: 'Uplift',
  retro: 'Retro', lofi: 'Lo-fi', silent: 'Silent',
};

export default function CallsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CallPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const previewRef = useRef<ToneHandle | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('notification_settings')
        .select('call_notifications, video_call_notifications, call_vibrate, call_ringtone, caller_tune, caller_tune_enabled, speaker_default_on, allow_unknown_callers')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setSettings({ ...DEFAULTS, ...data });
      setLoading(false);
    })();
    return () => { previewRef.current?.stop(); };
  }, [user]);

  const save = async (patch: Partial<CallPreferences>) => {
    if (!user) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    const { error } = await (supabase as any)
      .from('notification_settings')
      .upsert(
        { user_id: user.id, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) {
      toast.error('Could not save');
      setSettings(settings);
    } else {
      toast.success('Saved');
    }
  };

  const preview = (which: 'ringtone' | 'tune') => {
    previewRef.current?.stop();
    const pattern = which === 'ringtone'
      ? RINGTONES[settings.call_ringtone]
      : CALLER_TUNES[settings.caller_tune];
    previewRef.current = playPattern(pattern, { loop: false, volume: 0.25 });
    setTimeout(() => previewRef.current?.stop(), 2500);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold mb-1">Calls</h2>
        <p className="text-sm text-muted-foreground">
          Choose ringtones, caller tunes and how incoming calls behave.
        </p>
      </section>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Call notifications</h3>

        <Row icon={<Phone className="w-5 h-5" />} title="Voice calls" desc="Get notified for voice calls">
          <Switch checked={settings.call_notifications} onCheckedChange={(v) => save({ call_notifications: v })} />
        </Row>
        <Row icon={<Video className="w-5 h-5" />} title="Video calls" desc="Get notified for video calls">
          <Switch checked={settings.video_call_notifications} onCheckedChange={(v) => save({ video_call_notifications: v })} />
        </Row>
        <Row icon={<Vibrate className="w-5 h-5" />} title="Vibrate" desc="Vibrate your phone on incoming calls">
          <Switch checked={settings.call_vibrate} onCheckedChange={(v) => save({ call_vibrate: v })} />
        </Row>
      </motion.div>

      <Separator />

      {/* Ringtone */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Ringtone</h3>
        <p className="text-xs text-muted-foreground -mt-1">Played when someone calls you.</p>

        <Row icon={<Bell className="w-5 h-5" />} title="Call ringtone" desc="Choose the sound for incoming calls">
          <div className="flex items-center gap-2">
            <Select value={settings.call_ringtone} onValueChange={(v) => save({ call_ringtone: v })}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(RINGTONES).map((k) => (
                  <SelectItem key={k} value={k}>{RINGTONE_LABELS[k] ?? k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => preview('ringtone')} aria-label="Preview ringtone">
              <Play className="w-4 h-4" />
            </Button>
          </div>
        </Row>
      </motion.div>

      <Separator />

      {/* Caller tune */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Caller tune</h3>
        <p className="text-xs text-muted-foreground -mt-1">
          Played to you while the person you're calling is still ringing.
        </p>

        <Row icon={<Music className="w-5 h-5" />} title="Enable caller tune" desc="Play a tune while dialing">
          <Switch checked={settings.caller_tune_enabled} onCheckedChange={(v) => save({ caller_tune_enabled: v })} />
        </Row>
        <Row icon={<Music className="w-5 h-5" />} title="Tune" desc="Pick the tune you'll hear">
          <div className="flex items-center gap-2">
            <Select value={settings.caller_tune} onValueChange={(v) => save({ caller_tune: v })} disabled={!settings.caller_tune_enabled}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(CALLER_TUNES).map((k) => (
                  <SelectItem key={k} value={k}>{TUNE_LABELS[k] ?? k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => preview('tune')} aria-label="Preview caller tune" disabled={!settings.caller_tune_enabled}>
              <Play className="w-4 h-4" />
            </Button>
          </div>
        </Row>
      </motion.div>

      <Separator />

      {/* Behaviour */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Call behaviour</h3>

        <Row icon={<Volume2 className="w-5 h-5" />} title="Loudspeaker by default" desc="Start calls on the loudspeaker">
          <Switch checked={settings.speaker_default_on} onCheckedChange={(v) => save({ speaker_default_on: v })} />
        </Row>
        <Row icon={<UserX className="w-5 h-5" />} title="Allow calls from anyone" desc="If off, only people you follow can call you">
          <Switch checked={settings.allow_unknown_callers} onCheckedChange={(v) => save({ allow_unknown_callers: v })} />
        </Row>
      </motion.div>
    </div>
  );
}

function Row({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="text-muted-foreground shrink-0">{icon}</div>
        <div className="min-w-0">
          <Label className="font-medium">{title}</Label>
          <p className="text-sm text-muted-foreground truncate">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
