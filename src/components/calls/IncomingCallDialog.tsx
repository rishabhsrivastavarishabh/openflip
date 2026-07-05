import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useIncomingCalls } from '@/hooks/useIncomingCalls';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RINGTONES, playPattern, type ToneHandle } from '@/lib/callSounds';

interface CallPrefs {
  call_ringtone: string;
  ringtone: string; // legacy fallback
  notification_sound: boolean;
  call_notifications: boolean;
  video_call_notifications: boolean;
  call_vibrate: boolean;
}

const DEFAULTS: CallPrefs = {
  call_ringtone: 'default',
  ringtone: 'default',
  notification_sound: true,
  call_notifications: true,
  video_call_notifications: true,
  call_vibrate: true,
};

export function IncomingCallDialog() {
  const { incomingCall, accept, decline } = useIncomingCalls();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<CallPrefs>(DEFAULTS);
  const toneRef = useRef<ToneHandle | null>(null);
  const vibrateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load user's call/notification preferences.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('notification_settings')
        .select('call_ringtone, ringtone, notification_sound, call_notifications, video_call_notifications, call_vibrate')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) setPrefs({ ...DEFAULTS, ...data });
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    // Stop any prior ring & vibration.
    toneRef.current?.stop();
    toneRef.current = null;
    if (vibrateRef.current) {
      clearInterval(vibrateRef.current);
      vibrateRef.current = null;
    }
    try { navigator.vibrate?.(0); } catch {}

    if (!incomingCall) return;

    const isVideo = incomingCall.call_type === 'video';
    // Respect per-type notification toggles: if disabled, silently auto-decline
    // so the caller sees the missed state.
    if ((isVideo && !prefs.video_call_notifications) || (!isVideo && !prefs.call_notifications)) {
      decline();
      return;
    }

    // Ringtone
    if (prefs.notification_sound) {
      const choice = prefs.call_ringtone || prefs.ringtone || 'default';
      toneRef.current = playPattern(RINGTONES[choice], { loop: true, volume: 0.25 });
    }

    // Vibrate (mobile). Loop a short pattern until dismissed.
    if (prefs.call_vibrate && 'vibrate' in navigator) {
      try { navigator.vibrate([400, 250, 400, 250, 400]); } catch {}
      vibrateRef.current = setInterval(() => {
        try { navigator.vibrate([400, 250, 400, 250, 400]); } catch {}
      }, 2000);
    }

    return () => {
      toneRef.current?.stop();
      toneRef.current = null;
      if (vibrateRef.current) {
        clearInterval(vibrateRef.current);
        vibrateRef.current = null;
      }
      try { navigator.vibrate?.(0); } catch {}
    };
  }, [incomingCall, prefs, decline]);

  if (!incomingCall) return null;

  const handleAccept = async () => {
    const id = await accept();
    if (id) navigate(`/call/${id}`);
  };

  const displayName =
    incomingCall.caller?.full_name || incomingCall.caller?.username || 'Unknown';
  const isVideo = incomingCall.call_type === 'video';

  return (
    <Dialog open onOpenChange={(open) => !open && decline()}>
      <DialogContent className="max-w-sm text-center">
        <div className="flex flex-col items-center gap-4 py-6">
          <p className="text-sm text-muted-foreground">
            Incoming {isVideo ? 'video' : 'voice'} call
          </p>
          <Avatar className="w-24 h-24">
            <AvatarImage src={incomingCall.caller?.avatar_url || undefined} />
            <AvatarFallback className="text-2xl">
              {(displayName || 'U').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold">{displayName}</h2>
            <p className="text-sm text-muted-foreground">
              @{incomingCall.caller?.username}
            </p>
          </div>
          <div className="flex items-center gap-6 mt-4">
            <Button
              size="icon"
              variant="destructive"
              className="w-14 h-14 rounded-full"
              onClick={() => decline()}
              aria-label="Decline call"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>
            <Button
              size="icon"
              className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700"
              onClick={handleAccept}
              aria-label="Accept call"
            >
              {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
