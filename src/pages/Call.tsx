import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';

export default function Call() {
  const { callId } = useParams<{ callId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [call, setCall] = useState<any>(null);
  const [other, setOther] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!callId || !user) return;
    (async () => {
      const { data } = await supabase.from('calls').select('*').eq('id', callId).maybeSingle();
      if (!data) {
        navigate(-1);
        return;
      }
      setCall(data);
      const otherId = data.caller_id === user.id ? data.callee_id : data.caller_id;
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .eq('id', otherId)
        .maybeSingle();
      setOther(prof);
    })();

    const channel = supabase
      .channel(`call-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
        (payload) => {
          const updated = payload.new as any;
          setCall(updated);
          if (['ended', 'declined', 'cancelled', 'missed'].includes(updated.status)) {
            setTimeout(() => navigate(-1), 500);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId, user, navigate]);

  useEffect(() => {
    if (!call || call.status !== 'accepted') return;
    const start = call.started_at ? new Date(call.started_at).getTime() : Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call]);

  const hangUp = async () => {
    if (!callId) return;
    await supabase
      .from('calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', callId);
    navigate(-1);
  };

  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const displayName = other?.full_name || other?.username || 'Unknown';
  const isVideo = call?.call_type === 'video';

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-between p-8 z-50">
      <div className="mt-16 flex flex-col items-center gap-4">
        <Avatar className="w-32 h-32">
          <AvatarImage src={other?.avatar_url} />
          <AvatarFallback className="text-4xl bg-primary/20">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-2xl font-semibold">{displayName}</h1>
        <p className="text-sm text-white/70">
          {call?.status === 'ringing'
            ? 'Ringing…'
            : call?.status === 'accepted'
              ? format(elapsed)
              : call?.status ?? ''}
        </p>
        <p className="text-xs text-white/40 mt-4 max-w-xs text-center">
          Media streaming coming soon. This is the call signalling UI.
        </p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <Button
          size="icon"
          variant="secondary"
          className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 border-0"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>
        {isVideo && (
          <Button
            size="icon"
            variant="secondary"
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-white/20 border-0"
            onClick={() => setVideoOn((v) => !v)}
            aria-label={videoOn ? 'Turn off video' : 'Turn on video'}
          >
            {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>
        )}
        <Button
          size="icon"
          variant="destructive"
          className="w-16 h-16 rounded-full"
          onClick={hangUp}
          aria-label="End call"
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
