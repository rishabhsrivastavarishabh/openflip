import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

// STUN for direct P2P + free public TURN relays for NAT/firewall traversal.
// Without TURN, calls between users on symmetric NATs or restrictive networks
// (mobile carriers, corporate Wi-Fi) fail with "Connection failed".
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export default function Call() {
  const { callId } = useParams<{ callId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [call, setCall] = useState<any>(null);
  const [other, setOther] = useState<any>(null);
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [connState, setConnState] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const [videoActive, setVideoActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [upgrading, setUpgrading] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const hasOfferedRef = useRef(false);

  // Load call + peer profile, subscribe to status changes.
  useEffect(() => {
    if (!callId || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('calls').select('*').eq('id', callId).maybeSingle();
      if (!data || cancelled) {
        if (!cancelled) navigate(-1);
        return;
      }
      setCall(data);
      const otherId = data.caller_id === user.id ? data.callee_id : data.caller_id;
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .eq('id', otherId)
        .maybeSingle();
      if (!cancelled) setOther(prof);
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
            setTimeout(() => navigate(-1), 400);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [callId, user, navigate]);

  // Live timer once connected.
  useEffect(() => {
    if (!call || call.status !== 'accepted') return;
    const start = call.started_at ? new Date(call.started_at).getTime() : Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [call]);

  // Initial video state derives from call type; renegotiation may flip it later.
  useEffect(() => {
    if (call?.call_type === 'video') setVideoActive(true);
  }, [call?.call_type]);

  // Set up WebRTC once we know our role and the call is either ringing (caller waits)
  // or accepted (callee is here). We tear it all down on unmount / hangup.
  useEffect(() => {
    if (!call || !user || !callId) return;
    if (call.status === 'ended' || call.status === 'declined' || call.status === 'cancelled') return;

    const isCaller = call.caller_id === user.id;
    const isVideo = call.call_type === 'video';
    let disposed = false;

    const cleanup = () => {
      disposed = true;
      try {
        pcRef.current?.getSenders().forEach((s) => s.track?.stop());
        pcRef.current?.close();
      } catch {}
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (signalChanRef.current) {
        supabase.removeChannel(signalChanRef.current);
        signalChanRef.current = null;
      }
      remoteSetRef.current = false;
      pendingIceRef.current = [];
      hasOfferedRef.current = false;
    };

    const startPeer = async () => {
      if (pcRef.current) return;
      setConnState('connecting');

      // Grab mic (and cam for video calls).
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo ? { width: 640, height: 480 } : false,
        });
      } catch (err: any) {
        toast.error(err?.message || 'Could not access microphone. Check browser permissions.');
        setConnState('failed');
        return;
      }
      if (disposed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current && isVideo) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (ev) => {
        const [remote] = ev.streams;
        if (!remote) return;
        // Always attach — even audio-only calls that later get upgraded reuse this ref.
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
        if (remote.getVideoTracks().length > 0) setVideoActive(true);
      };

      pc.onconnectionstatechange = () => {
        if (!pcRef.current) return;
        const s = pcRef.current.connectionState;
        if (s === 'connected') setConnState('connected');
        else if (s === 'failed') setConnState('failed');
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate && signalChanRef.current) {
          signalChanRef.current.send({
            type: 'broadcast',
            event: 'ice',
            payload: { from: user.id, candidate: ev.candidate.toJSON() },
          });
        }
      };

      const applyPendingIce = async () => {
        for (const c of pendingIceRef.current) {
          try {
            await pc.addIceCandidate(c);
          } catch {}
        }
        pendingIceRef.current = [];
      };

      const chan = supabase.channel(`call-signal-${callId}`, {
        config: { broadcast: { self: false, ack: false } },
      });
      signalChanRef.current = chan;

      chan
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (isCaller || !pcRef.current) return;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          remoteSetRef.current = true;
          await applyPendingIce();
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          chan.send({
            type: 'broadcast',
            event: 'answer',
            payload: { from: user.id, sdp: answer },
          });
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (!isCaller || !pcRef.current) return;
          if (pcRef.current.signalingState === 'stable') return;
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          remoteSetRef.current = true;
          await applyPendingIce();
        })
        .on('broadcast', { event: 'ice' }, async ({ payload }) => {
          if (payload.from === user.id) return;
          if (!pcRef.current) return;
          if (!remoteSetRef.current) {
            pendingIceRef.current.push(payload.candidate);
            return;
          }
          try {
            await pcRef.current.addIceCandidate(payload.candidate);
          } catch {}
        })
        .on('broadcast', { event: 'ready' }, async ({ payload }) => {
          if (payload.from === user.id || !pcRef.current) return;
          if (isCaller) {
            if (hasOfferedRef.current) return;
            hasOfferedRef.current = true;
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            chan.send({
              type: 'broadcast',
              event: 'offer',
              payload: { from: user.id, sdp: offer },
            });
          } else if (!remoteSetRef.current) {
            // Caller just arrived (or missed our first ready) — re-announce so
            // they know we're here and can send the offer.
            chan.send({ type: 'broadcast', event: 'ready', payload: { from: user.id } });
          }
        })
        // ── Renegotiation: peer added video mid-call (audio→video upgrade). ──
        .on('broadcast', { event: 'renegotiate-offer' }, async ({ payload }) => {
          if (payload.from === user.id || !pcRef.current || !localStreamRef.current) return;
          // Ensure we also start sending our camera so it's a two-way video call.
          if (localStreamRef.current.getVideoTracks().length === 0) {
            try {
              const cam = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'user' }, width: 640, height: 480 },
              });
              const v = cam.getVideoTracks()[0];
              localStreamRef.current.addTrack(v);
              pcRef.current.addTrack(v, localStreamRef.current);
              if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
            } catch {
              // No camera / denied — still accept the incoming video (receive-only).
            }
          }
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const ans = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(ans);
          chan.send({
            type: 'broadcast',
            event: 'renegotiate-answer',
            payload: { from: user.id, sdp: ans },
          });
          setVideoActive(true);
          toast.message('Call upgraded to video');
        })
        .on('broadcast', { event: 'renegotiate-answer' }, async ({ payload }) => {
          if (payload.from === user.id || !pcRef.current) return;
          if (pcRef.current.signalingState === 'stable') return;
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          } catch {}
        })
        // ── Convert 1:1 call to a group meeting so more people can join. ──
        .on('broadcast', { event: 'move-to-meet' }, ({ payload }) => {
          if (payload.from === user.id) return;
          toast.message('Call moved to group meeting');
          navigate(`/meet/${payload.roomId}`);
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED' || disposed) return;
          // Announce arrival, then keep re-announcing until remote description is set.
          // Both sides announce so whichever subscribes last still triggers negotiation.
          const announce = () =>
            chan.send({ type: 'broadcast', event: 'ready', payload: { from: user.id } });
          announce();
          const iv = setInterval(() => {
            if (disposed || remoteSetRef.current) {
              clearInterval(iv);
              return;
            }
            announce();
          }, 1200);
        });

    };

    // Caller starts negotiating only once the callee has accepted.
    // Callee lands on this page after accepting, so it starts right away.
    const isCallerWaiting = isCaller && call.status !== 'accepted';
    if (!isCallerWaiting) {
      startPeer();
    }

    return cleanup;
    // Re-run when the call status flips to 'accepted' (so caller can join in).
  }, [call?.status, call?.caller_id, call?.call_type, callId, user]);

  const hangUp = async () => {
    if (!callId) return;
    await supabase
      .from('calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', callId);
    navigate(-1);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  };

  const toggleVideo = () => {
    const next = !videoOn;
    setVideoOn(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  };

  // Flip between front (user) and back (environment) cameras without dropping the peer.
  const switchCamera = async () => {
    if (!videoActive || !pcRef.current || !localStreamRef.current) return;
    const next = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next }, width: 640, height: 480 },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);
      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      localStreamRef.current.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setFacingMode(next);
    } catch (e: any) {
      toast.error(e?.message || 'Could not switch camera');
    }
  };

  // Upgrade an in-progress audio call to video: add a camera track and renegotiate.
  const upgradeToVideo = async () => {
    if (upgrading || videoActive) return;
    if (!pcRef.current || !localStreamRef.current || !signalChanRef.current || !user) return;
    setUpgrading(true);
    try {
      const cam = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: 640, height: 480 },
      });
      const vTrack = cam.getVideoTracks()[0];
      localStreamRef.current.addTrack(vTrack);
      pcRef.current.addTrack(vTrack, localStreamRef.current);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      signalChanRef.current.send({
        type: 'broadcast',
        event: 'renegotiate-offer',
        payload: { from: user.id, sdp: offer },
      });
      setVideoActive(true);
      setVideoOn(true);
    } catch (e: any) {
      toast.error(e?.message || 'Could not turn on video');
    } finally {
      setUpgrading(false);
    }
  };

  // Move both parties into a Meet room so more people can be invited.
  const addPeople = async () => {
    if (!callId || !user) return;
    const roomId = callId;
    signalChanRef.current?.send({
      type: 'broadcast',
      event: 'move-to-meet',
      payload: { from: user.id, roomId },
    });
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/meet/${roomId}`);
      toast.success('Meeting link copied — share it to invite others');
    } catch {
      toast.message('Opening group meeting…');
    }
    // Mark the 1:1 call as ended so it stops ringing / shows up correctly in logs.
    await supabase
      .from('calls')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', callId);
    navigate(`/meet/${roomId}`);
  };

  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const displayName = other?.full_name || other?.username || 'Unknown';
  const isVideo = call?.call_type === 'video';

  const statusLabel =
    call?.status === 'ringing'
      ? 'Ringing…'
      : connState === 'connecting'
        ? 'Connecting…'
        : connState === 'failed'
          ? 'Connection failed'
          : call?.status === 'accepted'
            ? format(elapsed)
            : (call?.status ?? '');

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden bg-black p-8 text-white">
      {/* soft radial glow to match glassmorphism language */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(1200px 600px at 50% -10%, hsl(var(--primary) / 0.35), transparent 60%), radial-gradient(800px 500px at 80% 100%, hsl(var(--accent) / 0.25), transparent 60%)',
        }}
      />

      {videoActive && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <audio ref={remoteAudioRef} autoPlay />

      <div className="relative z-10 mt-16 flex flex-col items-center gap-4">
        {!videoActive && (
          <Avatar className="h-32 w-32 ring-4 ring-white/20">
            <AvatarImage src={other?.avatar_url} />
            <AvatarFallback className="bg-primary/20 text-4xl">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <h1 className="text-2xl font-semibold drop-shadow">{displayName}</h1>
        <p className="text-sm text-white/80">{statusLabel}</p>
      </div>

      {videoActive && videoOn && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-28 right-6 z-10 h-40 w-28 rounded-2xl border border-white/20 object-cover shadow-2xl"
        />
      )}

      <div className="relative z-10 mb-8 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 p-3 backdrop-blur-xl">
        <Button
          size="icon"
          variant="secondary"
          className="h-14 w-14 rounded-full border-0 bg-white/10 hover:bg-white/20"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        {videoActive && (
          <Button
            size="icon"
            variant="secondary"
            className="h-14 w-14 rounded-full border-0 bg-white/10 hover:bg-white/20"
            onClick={toggleVideo}
            aria-label={videoOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        )}
        {videoActive && (
          <Button
            size="icon"
            variant="secondary"
            className="h-14 w-14 rounded-full border-0 bg-white/10 hover:bg-white/20"
            onClick={switchCamera}
            aria-label="Switch camera"
          >
            <SwitchCamera className="h-5 w-5" />
          </Button>
        )}
        {!videoActive && (
          <Button
            size="icon"
            variant="secondary"
            className="h-14 w-14 rounded-full border-0 bg-white/10 hover:bg-white/20"
            onClick={upgradeToVideo}
            disabled={upgrading || connState !== 'connected'}
            aria-label="Turn on video"
          >
            <Video className="h-5 w-5" />
          </Button>
        )}
        <Button
          size="icon"
          variant="secondary"
          className="h-14 w-14 rounded-full border-0 bg-white/10 hover:bg-white/20"
          onClick={addPeople}
          aria-label="Add people to call"
        >
          <UserPlus className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          variant="destructive"
          className="h-16 w-16 rounded-full shadow-lg"
          onClick={hangUp}
          aria-label="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
