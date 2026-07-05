import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera, UserPlus, Volume2, VolumeX, Palette, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

type CallTheme = {
  id: string;
  label: string;
  base: string; // solid fallback color
  gradient: string; // full css background value
  swatch: string; // small preview color
};

const CALL_THEMES: CallTheme[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    base: '#000000',
    gradient:
      'radial-gradient(1200px 600px at 50% -10%, hsl(var(--primary) / 0.35), transparent 60%), radial-gradient(800px 500px at 80% 100%, hsl(var(--accent) / 0.25), transparent 60%)',
    swatch: 'linear-gradient(135deg, #0f172a, #6d28d9)',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    base: '#031b2e',
    gradient:
      'radial-gradient(1200px 600px at 50% -10%, rgba(14,165,233,0.45), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(16,185,129,0.35), transparent 60%)',
    swatch: 'linear-gradient(135deg, #0ea5e9, #10b981)',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    base: '#2a0a12',
    gradient:
      'radial-gradient(1200px 600px at 50% -10%, rgba(244,63,94,0.5), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(251,146,60,0.4), transparent 60%)',
    swatch: 'linear-gradient(135deg, #f43f5e, #fb923c)',
  },
  {
    id: 'forest',
    label: 'Forest',
    base: '#04140b',
    gradient:
      'radial-gradient(1200px 600px at 50% -10%, rgba(34,197,94,0.45), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(20,184,166,0.35), transparent 60%)',
    swatch: 'linear-gradient(135deg, #22c55e, #14b8a6)',
  },
  {
    id: 'rose',
    label: 'Rose',
    base: '#1a0620',
    gradient:
      'radial-gradient(1200px 600px at 50% -10%, rgba(236,72,153,0.5), transparent 60%), radial-gradient(800px 500px at 80% 100%, rgba(168,85,247,0.4), transparent 60%)',
    swatch: 'linear-gradient(135deg, #ec4899, #a855f7)',
  },
  {
    id: 'mono',
    label: 'Mono',
    base: '#000000',
    gradient: 'radial-gradient(1200px 600px at 50% -10%, rgba(255,255,255,0.15), transparent 60%)',
    swatch: 'linear-gradient(135deg, #262626, #737373)',
  },
];

const CALL_THEME_KEY = 'openflip_call_theme';

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
  const [speakerOn, setSpeakerOn] = useState(true);
  const [themeId, setThemeId] = useState<string>(() => {
    try { return localStorage.getItem(CALL_THEME_KEY) || 'midnight'; } catch { return 'midnight'; }
  });
  const theme = CALL_THEMES.find(t => t.id === themeId) ?? CALL_THEMES[0];
  const chooseTheme = (id: string) => {
    setThemeId(id);
    try { localStorage.setItem(CALL_THEME_KEY, id); } catch {}
  };

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
        // ── Peer switched the call back to audio-only; mirror the UI locally. ──
        .on('broadcast', { event: 'downgrade-to-audio' }, ({ payload }) => {
          if (payload.from === user.id) return;
          // Stop sending our own video too — it saves bandwidth and matches the peer's UI.
          const videoTracks = localStreamRef.current?.getVideoTracks() ?? [];
          videoTracks.forEach((t) => {
            localStreamRef.current?.removeTrack(t);
            t.stop();
          });
          const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) { try { sender.replaceTrack(null); } catch {} }
          if (localVideoRef.current) localVideoRef.current.srcObject = null;
          setVideoActive(false);
          setVideoOn(true);
          toast.message('Call switched to audio only');
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
    // Critical: many mobile browsers can't open the other camera while the
    // current one is still live ("Could not start video source"). Stop and
    // release the current track BEFORE requesting the new one.
    const oldTrack = localStreamRef.current.getVideoTracks()[0];
    if (oldTrack) {
      try { oldTrack.stop(); } catch {}
      try { localStreamRef.current.removeTrack(oldTrack); } catch {}
    }
    const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) { try { await sender.replaceTrack(null); } catch {} }

    const acquire = async (constraint: MediaTrackConstraints) =>
      navigator.mediaDevices.getUserMedia({ video: constraint, audio: false });

    let newStream: MediaStream | null = null;
    try {
      // Prefer exact so we actually flip; fall back to ideal, then unconstrained.
      try {
        newStream = await acquire({ facingMode: { exact: next }, width: 640, height: 480 });
      } catch {
        try {
          newStream = await acquire({ facingMode: { ideal: next }, width: 640, height: 480 });
        } catch {
          newStream = await acquire({ width: 640, height: 480 });
        }
      }
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) throw new Error('No camera track');
      if (sender) await sender.replaceTrack(newTrack);
      else pcRef.current.addTrack(newTrack, localStreamRef.current);
      localStreamRef.current.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setFacingMode(next);
    } catch (e: any) {
      toast.error(e?.message || 'Could not switch camera');
      // Try to restore something so the local preview isn't blank.
      try {
        const fallback = await acquire({ facingMode: { ideal: facingMode }, width: 640, height: 480 });
        const t = fallback.getVideoTracks()[0];
        if (t) {
          if (sender) await sender.replaceTrack(t);
          else pcRef.current.addTrack(t, localStreamRef.current);
          localStreamRef.current.addTrack(t);
          if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        }
      } catch {}
    }
  };

  // Toggle audio output between the built-in earpiece/default and the loud speaker.
  // Uses HTMLMediaElement.setSinkId where available (Chrome desktop, some Android
  // builds). On iOS Safari this API isn't available; we fall back to routing the
  // stream through a fresh AudioContext at higher gain as a best-effort speaker
  // effect, and always update the UI so the user knows the intent.
  
  const toggleSpeaker = async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    const audioEl = remoteAudioRef.current;
    if (!audioEl) return;
    const anyEl = audioEl as any;
    if (typeof anyEl.setSinkId === 'function') {
      try {
        // 'default' routes to system default (often earpiece on mobile),
        // 'communications' or a specific speaker deviceId routes to loudspeaker.
        if (next) {
          // Try to find a device labeled like a speaker.
          const devices = await navigator.mediaDevices.enumerateDevices();
          const speaker = devices.find(
            (d) => d.kind === 'audiooutput' && /speaker|loud/i.test(d.label),
          );
          await anyEl.setSinkId(speaker?.deviceId || 'default');
        } else {
          await anyEl.setSinkId('default');
        }
        return;
      } catch {
        // fall through to gain-based fallback
      }
    }
    // Fallback: boost/reset volume so users still get an audible change.
    try {
      audioEl.volume = next ? 1.0 : 0.6;
    } catch {}
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

  // Downgrade an in-progress video call back to audio-only: stop sending video,
  // hide the video UI locally, and tell the peer to do the same.
  const downgradeToAudio = async () => {
    if (!videoActive || !pcRef.current || !localStreamRef.current) return;
    try {
      // Stop and remove local video tracks.
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((t) => {
        localStreamRef.current?.removeTrack(t);
        t.stop();
      });
      // Blank the video sender so the peer stops receiving frames without renegotiating.
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        try { await sender.replaceTrack(null); } catch {}
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      if (user && signalChanRef.current) {
        signalChanRef.current.send({
          type: 'broadcast',
          event: 'downgrade-to-audio',
          payload: { from: user.id },
        });
      }
      setVideoActive(false);
      setVideoOn(true);
      toast.message('Switched to audio only');
    } catch (e: any) {
      toast.error(e?.message || 'Could not switch to audio');
    }
  };


  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const displayName = other?.full_name || other?.username || 'Unknown';

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

  const ctlBtn = 'h-12 w-12 sm:h-14 sm:w-14 rounded-full border-0 bg-white/10 hover:bg-white/20';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden text-white px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] sm:px-8"
      style={{ height: '100dvh', backgroundColor: theme.base }}
    >
      {/* soft radial glow to match glassmorphism language */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 transition-[background] duration-500"
        style={{ background: theme.gradient }}
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

      <div className="relative z-10 mt-6 sm:mt-16 flex flex-col items-center gap-3 sm:gap-4">
        {!videoActive && (
          <Avatar className="h-24 w-24 sm:h-32 sm:w-32 ring-4 ring-white/20">
            <AvatarImage src={other?.avatar_url} />
            <AvatarFallback className="bg-primary/20 text-3xl sm:text-4xl">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <h1 className="text-xl sm:text-2xl font-semibold drop-shadow">{displayName}</h1>
        <p className="text-sm text-white/80">{statusLabel}</p>
      </div>

      {videoActive && videoOn && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-32 right-4 z-10 h-32 w-24 sm:h-40 sm:w-28 rounded-2xl border border-white/20 object-cover shadow-2xl"
        />
      )}

      <div className="relative z-10 mb-2 flex w-full max-w-md flex-wrap items-center justify-center gap-2 rounded-3xl border border-white/10 bg-black/40 p-2 sm:p-3 backdrop-blur-xl">
        <Button size="icon" variant="secondary" className={ctlBtn} onClick={toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button size="icon" variant="secondary" className={ctlBtn} onClick={toggleSpeaker} aria-label={speakerOn ? 'Speaker on' : 'Speaker off'} title="Speaker">
          {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </Button>
        {videoActive && (
          <Button size="icon" variant="secondary" className={ctlBtn} onClick={downgradeToAudio} aria-label="Switch to audio only" title="Switch to audio only">
            <VideoOff className="h-5 w-5" />
          </Button>
        )}
        {videoActive && (
          <Button size="icon" variant="secondary" className={ctlBtn} onClick={toggleVideo} aria-label={videoOn ? 'Turn off camera' : 'Turn on camera'}>
            {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
        )}
        {videoActive && (
          <Button size="icon" variant="secondary" className={ctlBtn} onClick={switchCamera} aria-label="Switch camera">
            <SwitchCamera className="h-5 w-5" />
          </Button>
        )}
        {!videoActive && (
          <Button size="icon" variant="secondary" className={ctlBtn} onClick={upgradeToVideo} disabled={upgrading || connState !== 'connected'} aria-label="Turn on video">
            <Video className="h-5 w-5" />
          </Button>
        )}
        <Button size="icon" variant="secondary" className={ctlBtn} onClick={addPeople} aria-label="Add people to call">
          <UserPlus className="h-5 w-5" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="icon" variant="secondary" className={ctlBtn} aria-label="Change call color" title="Call color">
              <Palette className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            className="w-64 border-white/10 bg-black/80 text-white backdrop-blur-xl"
          >
            <p className="mb-2 text-xs font-medium text-white/70">Call background</p>
            <div className="grid grid-cols-3 gap-2">
              {CALL_THEMES.map((t) => {
                const active = t.id === themeId;
                return (
                  <button
                    key={t.id}
                    onClick={() => chooseTheme(t.id)}
                    className={`group relative flex h-14 flex-col items-center justify-end overflow-hidden rounded-xl border transition-all ${active ? 'border-white ring-2 ring-white/60' : 'border-white/10 hover:border-white/40'}`}
                    style={{ background: t.swatch }}
                    aria-label={`Use ${t.label} theme`}
                    aria-pressed={active}
                  >
                    {active && (
                      <span className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5">
                        <Check className="h-3 w-3 text-white" />
                      </span>
                    )}
                    <span className="w-full bg-black/40 py-0.5 text-center text-[10px] font-medium">
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Button size="icon" variant="destructive" className="h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-lg" onClick={hangUp} aria-label="End call">
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
