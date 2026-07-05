import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useIncomingCalls } from '@/hooks/useIncomingCalls';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Distinct oscillator patterns per ringtone choice so the setting has an
// audible effect. `freqs` cycles through notes each beat; `beat` is the
// on-time in ms; `gap` is the silence between beats.
const RINGTONE_PATTERNS: Record<
  string,
  { freqs: number[]; beat: number; gap: number; type: OscillatorType }
> = {
  default: { freqs: [440, 480], beat: 900, gap: 600, type: 'sine' },
  chime:   { freqs: [660, 880, 990], beat: 220, gap: 120, type: 'sine' },
  ding:    { freqs: [1200], beat: 180, gap: 900, type: 'triangle' },
  pop:     { freqs: [520, 380], beat: 90, gap: 260, type: 'square' },
  swoosh:  { freqs: [300, 500, 700, 900], beat: 90, gap: 60, type: 'sawtooth' },
};

export function IncomingCallDialog() {
  const { incomingCall, accept, decline } = useIncomingCalls();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ringtone, setRingtone] = useState<string>('default');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const ctxRef = useRef<AudioContext | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Load user's ringtone preference so the setting actually applies.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('notification_settings')
        .select('ringtone, notification_sound')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.ringtone) setRingtone(data.ringtone);
      if (data?.notification_sound === false) setSoundEnabled(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    // Stop any previous ring.
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }

    if (!incomingCall) return;
    if (!soundEnabled || ringtone === 'none') return;

    const AudioCtx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const pattern = RINGTONE_PATTERNS[ringtone] ?? RINGTONE_PATTERNS.default;
    const ctx: AudioContext = new AudioCtx();
    ctxRef.current = ctx;
    // Autoplay policies leave AudioContext suspended until a user gesture.
    // Try to resume proactively; if it stays suspended, the notification
    // permission gesture (or the user tapping Accept/Decline) will unlock it.
    ctx.resume().catch(() => {});

    let cancelled = false;
    let idx = 0;

    const playOne = () => {
      if (cancelled || ctx.state === 'closed') return;
      const freq = pattern.freqs[idx % pattern.freqs.length];
      idx += 1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = pattern.type;
      osc.frequency.value = freq;
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(ctx.destination);
      const now = ctx.currentTime;
      const attack = 0.02;
      const dur = pattern.beat / 1000;
      gain.gain.exponentialRampToValueAtTime(0.2, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.start(now);
      osc.stop(now + dur + 0.02);
      const t = setTimeout(playOne, pattern.beat + pattern.gap);
      timersRef.current.push(t);
    };

    playOne();

    return () => {
      cancelled = true;
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
      ctx.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [incomingCall, ringtone, soundEnabled]);

  if (!incomingCall) return null;

  const handleAccept = async () => {
    // Unlock AudioContext for the outbound call page as a side effect of the
    // user gesture.
    ctxRef.current?.resume().catch(() => {});
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
