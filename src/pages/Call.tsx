import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, MicOff, Video, VideoOff, SwitchCamera, UserPlus, Volume2, VolumeX, Palette, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { CALLER_TUNES, playPattern, type ToneHandle } from '@/lib/callSounds';

// STUN for direct P2P + multiple free public TURN relays for NAT/firewall
// traversal. Without TURN, calls between users on symmetric NATs or
// restrictive networks (mobile carriers, corporate Wi-Fi) fail with
// "Connection failed". We list several providers/ports so a block on one
// still leaves working paths (UDP 3478, UDP/TCP 80, UDP/TCP 443).
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:80?transport=tcp',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turns:global.relay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

// High-quality video constraints: request up to 4K (2160p) at 30fps.
// Browsers will negotiate down automatically if the camera/network can't handle it.
const VIDEO_CONSTRAINTS_4K: MediaTrackConstraints = {
  width: { ideal: 3840, max: 3840 },
  height: { ideal: 2160, max: 2160 },
  frameRate: { ideal: 30, max: 60 },
};

// HD audio: full-band stereo capture at 48 kHz with the usual voice cleanup.
const AUDIO_CONSTRAINTS_HD: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: { ideal: 2 },
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
  latency: { ideal: 0.01 },
};

// Ask Opus for stereo, full-band audio at a high average bitrate with in-band FEC
// (packet-loss resilience) and DTX off so quiet passages stay natural.
const HD_OPUS_PARAMS =
  'stereo=1;sprop-stereo=1;maxaveragebitrate=256000;maxplaybackrate=48000;' +
  'sprop-maxcapturerate=48000;useinbandfec=1;usedtx=0;cbr=0';

const applyHdAudioSdp = (sdp: string): string => {
  const payloads = [...sdp.matchAll(/^a=rtpmap:(\d+)\s+opus\/48000/gim)].map((m) => m[1]);
  let out = sdp;
  for (const pt of payloads) {
    const fmtp = new RegExp(`^a=fmtp:${pt} (.*)$`, 'im');
    if (fmtp.test(out)) {
      out = out.replace(fmtp, (_m, existing: string) => {
        const kept = existing
          .split(';')
          .filter((p) => p && !/^(stereo|sprop-stereo|maxaveragebitrate|maxplaybackrate|sprop-maxcapturerate|useinbandfec|usedtx|cbr)=/i.test(p.trim()))
          .join(';');
        return `a=fmtp:${pt} ${kept ? kept + ';' : ''}${HD_OPUS_PARAMS}`;
      });
    } else {
      out = out.replace(
        new RegExp(`^(a=rtpmap:${pt} opus/48000.*)$`, 'im'),
        `$1\r\na=fmtp:${pt} ${HD_OPUS_PARAMS}`,
      );
    }
  }
  return out;
};

// Set a local offer/answer with the HD-audio tweaks applied to the SDP.
const setLocalHd = async (
  pc: RTCPeerConnection,
  desc: RTCSessionDescriptionInit,
): Promise<RTCSessionDescriptionInit> => {
  const tuned: RTCSessionDescriptionInit = {
    type: desc.type,
    sdp: desc.sdp ? applyHdAudioSdp(desc.sdp) : desc.sdp,
  };
  try {
    await pc.setLocalDescription(tuned);
    return tuned;
  } catch {
    await pc.setLocalDescription(desc);
    return desc;
  }
};

// Give the audio stream plenty of headroom and network priority.
const tuneAudioSender = async (sender: RTCRtpSender) => {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = 256_000;
    (params.encodings[0] as any).networkPriority = 'high';
    (params.encodings[0] as any).priority = 'high';
    (params as any).degradationPreference = 'maintain-resolution';
    await sender.setParameters(params);
  } catch { /* older browsers ignore */ }
};


// Configure a video sender for 4K + low-latency: high bitrate cap and
// prefer smooth framerate over resolution when bandwidth dips.
const tuneVideoSender = async (sender: RTCRtpSender) => {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    // ~15 Mbps ceiling supports 4K@30 comfortably; drops gracefully on weak links.
    params.encodings[0].maxBitrate = 15_000_000;
    params.encodings[0].maxFramerate = 30;
    (params as any).degradationPreference = 'maintain-framerate';
    await sender.setParameters(params);
  } catch { /* older browsers ignore */ }
};

// Minimize the receiver jitter buffer to cut playout delay (lower latency).
const tuneReceiver = (receiver: RTCRtpReceiver) => {
  try {
    (receiver as any).playoutDelayHint = 0;
    (receiver as any).jitterBufferTarget = 0;
  } catch {}
};

type CallTheme = {
  id: string;
  label: string;
  base: string; // solid fallback color
  gradient: string; // full css background value
  swatch: string; // small preview color
};

const CALL_THEMES: CallTheme[] = [
  {
    id: 'ember',
    label: 'Ember',
    // White + red mixed: bright canvas softened with red glows so foreground
    // controls stay readable on light backgrounds.
    base: '#f8fafc',
    gradient:
      'radial-gradient(1200px 600px at 50% -10%, rgba(220,38,38,0.55), rgba(255,255,255,0) 60%), radial-gradient(800px 500px at 80% 100%, rgba(239,68,68,0.35), rgba(255,255,255,0) 60%), linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65))',
    swatch: 'linear-gradient(135deg, #ffffff 0%, #ffffff 45%, #ef4444 100%)',
  },
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
    try { return localStorage.getItem(CALL_THEME_KEY) || 'ember'; } catch { return 'ember'; }
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
  const callerTuneRef = useRef<ToneHandle | null>(null);

  // Play caller tune while dialing (caller-side only, until status flips).
  useEffect(() => {
    if (!call || !user) return;
    const isCaller = call.caller_id === user.id;
    const isRinging = call.status === 'ringing' || call.status === 'initiated' || !call.status;
    if (!isCaller || !isRinging) {
      callerTuneRef.current?.stop();
      callerTuneRef.current = null;
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('notification_settings')
        .select('caller_tune, caller_tune_enabled, speaker_default_on')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.speaker_default_on) setSpeakerOn(true);
      if (data?.caller_tune_enabled === false) return;
      const tune = data?.caller_tune || 'default';
      callerTuneRef.current?.stop();
      callerTuneRef.current = playPattern(CALLER_TUNES[tune], { loop: true, volume: 0.18 });
    })();
    return () => {
      cancelled = true;
      callerTuneRef.current?.stop();
      callerTuneRef.current = null;
    };
  }, [call?.caller_id, call?.status, user]);

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
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: isVideo ? VIDEO_CONSTRAINTS_4K : false,
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

      const pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, stream);
        if (track.kind === 'video') tuneVideoSender(sender);
      });

      pc.ontrack = (ev) => {
        tuneReceiver(ev.receiver);
        const [remote] = ev.streams;
        if (!remote) return;
        // Always attach — even audio-only calls that later get upgraded reuse this ref.
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
        if (remote.getVideoTracks().length > 0) setVideoActive(true);
      };

      // Watchdog: if the connection drops or fails, try ICE restart before
      // giving up. Only the caller triggers the restart (creates a new offer);
      // the callee will answer it via the normal offer/answer handlers below.
      let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let restartAttempts = 0;
      const tryIceRestart = async () => {
        if (!pcRef.current || !isCaller || !signalChanRef.current) return;
        if (restartAttempts >= 3) { setConnState('failed'); return; }
        restartAttempts++;
        try {
          const offer = await pcRef.current.createOffer({ iceRestart: true });
          await pcRef.current.setLocalDescription(offer);
          signalChanRef.current.send({
            type: 'broadcast',
            event: 'offer',
            payload: { from: user.id, sdp: offer },
          });
        } catch { /* will retry on next state change */ }
      };

      pc.onconnectionstatechange = () => {
        if (!pcRef.current) return;
        const s = pcRef.current.connectionState;
        if (s === 'connected') {
          setConnState('connected');
          restartAttempts = 0;
          if (disconnectTimer) { clearTimeout(disconnectTimer); disconnectTimer = null; }
        } else if (s === 'disconnected') {
          setConnState('connecting');
          if (disconnectTimer) clearTimeout(disconnectTimer);
          // Give the network 3s to recover on its own; then restart ICE.
          disconnectTimer = setTimeout(() => { tryIceRestart(); }, 3000);
        } else if (s === 'failed') {
          setConnState('connecting');
          tryIceRestart();
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (!pcRef.current) return;
        const s = pcRef.current.iceConnectionState;
        if (s === 'failed') tryIceRestart();
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
          try {
            // CRITICAL: apply remote SDP FIRST so the video m-line exists,
            // then attach our camera onto that transceiver. Doing it in the
            // opposite order created a stray m-line and the upgrade failed.
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));

            // Also start sending our camera so it's a two-way video call.
            if (localStreamRef.current.getVideoTracks().length === 0) {
              try {
                const cam = await navigator.mediaDevices.getUserMedia({
                  video: { facingMode: { ideal: 'user' }, ...VIDEO_CONSTRAINTS_4K },
                });
                const v = cam.getVideoTracks()[0];
                localStreamRef.current.addTrack(v);
                // Prefer reusing the transceiver the offer created (avoids new m-line).
                const videoTx = pcRef.current
                  .getTransceivers()
                  .find((t) => t.receiver.track?.kind === 'video' && !t.sender.track);
                if (videoTx) {
                  await videoTx.sender.replaceTrack(v);
                  try { videoTx.direction = 'sendrecv'; } catch {}
                  tuneVideoSender(videoTx.sender);
                } else {
                  const s = pcRef.current.addTrack(v, localStreamRef.current);
                  tuneVideoSender(s);
                }
                if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
              } catch {
                // No camera / denied — still accept the incoming video (receive-only).
              }
            }

            const ans = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(ans);
            chan.send({
              type: 'broadcast',
              event: 'renegotiate-answer',
              payload: { from: user.id, sdp: ans },
            });
            setVideoActive(true);
            toast.message('Call upgraded to video');
          } catch (e) {
            console.error('renegotiate-offer failed', e);
          }
        })
        .on('broadcast', { event: 'renegotiate-answer' }, async ({ payload }) => {
          if (payload.from === user.id || !pcRef.current) return;
          if (pcRef.current.signalingState !== 'have-local-offer') return;
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          } catch (e) {
            console.error('renegotiate-answer failed', e);
          }
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
          }, 400);
        });

    };

    // Both sides start immediately. The caller pre-warms getUserMedia, the
    // RTCPeerConnection, ICE gathering, and the signaling channel while the
    // callee's device is still ringing — so when the callee accepts, the
    // "ready" handshake fires an offer with candidates already in flight.
    // This cuts multi-second "Connecting..." delays down to sub-second.
    startPeer();

    return cleanup;
    // Re-run when the call type or IDs change; NOT on status, so we don't
    // tear down the pre-warmed peer when status flips ringing → accepted.
  }, [call?.caller_id, call?.call_type, callId, user]);

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
        newStream = await acquire({ facingMode: { exact: next }, ...VIDEO_CONSTRAINTS_4K });
      } catch {
        try {
          newStream = await acquire({ facingMode: { ideal: next }, ...VIDEO_CONSTRAINTS_4K });
        } catch {
          newStream = await acquire({ ...VIDEO_CONSTRAINTS_4K });
        }
      }
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) throw new Error('No camera track');
      if (sender) {
        await sender.replaceTrack(newTrack);
        tuneVideoSender(sender);
      } else {
        const s = pcRef.current.addTrack(newTrack, localStreamRef.current);
        tuneVideoSender(s);
      }
      localStreamRef.current.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setFacingMode(next);
    } catch (e: any) {
      toast.error(e?.message || 'Could not switch camera');
      // Try to restore something so the local preview isn't blank.
      try {
        const fallback = await acquire({ facingMode: { ideal: facingMode }, ...VIDEO_CONSTRAINTS_4K });
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
        video: { facingMode: { ideal: facingMode }, ...VIDEO_CONSTRAINTS_4K },
      });
      const vTrack = cam.getVideoTracks()[0];
      localStreamRef.current.addTrack(vTrack);

      // Reuse an existing recv-only video transceiver if one exists; else add one.
      // Using replaceTrack on an existing transceiver avoids creating a duplicate
      // m-line, which was breaking the upgrade renegotiation.
      const existingTx = pcRef.current
        .getTransceivers()
        .find((t) => (t.receiver.track?.kind === 'video' || t.sender.track?.kind === 'video') && !t.sender.track);
      let vSender: RTCRtpSender;
      if (existingTx) {
        await existingTx.sender.replaceTrack(vTrack);
        try { existingTx.direction = 'sendrecv'; } catch {}
        vSender = existingTx.sender;
      } else {
        vSender = pcRef.current.addTrack(vTrack, localStreamRef.current);
      }
      tuneVideoSender(vSender);

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
      console.error('upgradeToVideo failed', e);
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

  const ctlBtn = 'h-12 w-12 sm:h-14 sm:w-14 rounded-full border border-white/10 bg-neutral-900/80 text-white hover:bg-neutral-800/90 shadow-md';
  const isLightTheme = theme.id === 'ember';

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] sm:px-8 ${isLightTheme ? 'text-slate-900' : 'text-white'}`}
      style={{ height: '100dvh', backgroundColor: theme.base }}
    >
      {/* soft radial glow to match glassmorphism language */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90 transition-[background] duration-500"
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
          <Avatar className={`h-24 w-24 sm:h-32 sm:w-32 ring-4 ${isLightTheme ? 'ring-red-500/30' : 'ring-white/20'}`}>
            <AvatarImage src={other?.avatar_url} />
            <AvatarFallback className="bg-primary/20 text-3xl sm:text-4xl">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <h1 className="text-xl sm:text-2xl font-semibold drop-shadow">{displayName}</h1>
        <p className={`text-sm ${isLightTheme ? 'text-red-600/90' : 'text-white/80'}`}>{statusLabel}</p>
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
