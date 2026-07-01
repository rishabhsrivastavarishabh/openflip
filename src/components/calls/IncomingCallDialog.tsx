import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useIncomingCalls } from '@/hooks/useIncomingCalls';

export function IncomingCallDialog() {
  const { incomingCall, accept, decline } = useIncomingCalls();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!incomingCall) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }
    // Simple ringing tone via WebAudio (no external asset needed).
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    let cancelled = false;

    const playPattern = () => {
      if (cancelled) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.value = 0.0001;
      osc.connect(gain).connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      osc.start(now);
      osc.stop(now + 1.0);
    };

    playPattern();
    const interval = setInterval(playPattern, 1500);

    return () => {
      cancelled = true;
      clearInterval(interval);
      ctx.close().catch(() => {});
    };
  }, [incomingCall]);

  if (!incomingCall) return null;

  const handleAccept = async () => {
    const id = await accept();
    if (id) navigate(`/call/${id}`);
  };

  const displayName = incomingCall.caller?.full_name || incomingCall.caller?.username || 'Unknown';
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
