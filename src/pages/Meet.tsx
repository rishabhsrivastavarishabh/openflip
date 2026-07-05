import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, PhoneOff, Link2, Users, Video, VideoOff, SwitchCamera, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';

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

type PeerEntry = {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  remoteStream: MediaStream;
  username?: string;
  avatarUrl?: string;
  pendingIce: RTCIceCandidateInit[];
  remoteSet: boolean;
};

export default function Meet() {
  const { roomId } = useParams<{ roomId: string }>();
  const [search] = useSearchParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [muted, setMuted] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [speakerOn, setSpeakerOn] = useState(true);
  const [peers, setPeers] = useState<
    Record<string, { username?: string; avatarUrl?: string; stream?: MediaStream }>
  >({});
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(true);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<Record<string, PeerEntry>>({});
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!roomId || !user) return;
    let disposed = false;

    const cleanup = () => {
      disposed = true;
      Object.values(peersRef.current).forEach(({ pc, audio }) => {
        try { pc.close(); } catch {}
        audio.srcObject = null;
        audio.remove();
      });
      peersRef.current = {};
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      if (chanRef.current) {
        supabase.removeChannel(chanRef.current);
        chanRef.current = null;
      }
    };

    const start = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err: any) {
        toast.error(err?.message || 'Microphone access denied.');
        setConnecting(false);
        return;
      }
      if (disposed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;

      const chan = supabase.channel(`meet-${roomId}`, {
        config: { broadcast: { self: false, ack: false } },
      });
      chanRef.current = chan;

      const createPeer = (peerId: string): PeerEntry => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
        const audio = document.createElement('audio');
        audio.autoplay = true;
        document.body.appendChild(audio);
        const remoteStream = new MediaStream();

        pc.ontrack = (ev) => {
          ev.streams[0]?.getTracks().forEach((t) => {
            if (!remoteStream.getTracks().find((x) => x.id === t.id)) remoteStream.addTrack(t);
          });
          audio.srcObject = remoteStream;
          // Force React to re-attach the video element via a state bump.
          setPeers((p) => ({
            ...p,
            [peerId]: { ...(p[peerId] || {}), stream: remoteStream },
          }));
        };
        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            chan.send({
              type: 'broadcast',
              event: 'ice',
              payload: { from: user.id, to: peerId, candidate: ev.candidate.toJSON() },
            });
          }
        };
        pc.onnegotiationneeded = async () => {
          // Only the deterministic offerer initiates renegotiation to avoid glare.
          if (user.id >= peerId) return;
          try {
            const offer = await pc.createOffer();
            if (pc.signalingState !== 'stable') return;
            await pc.setLocalDescription(offer);
            chan.send({
              type: 'broadcast',
              event: 'offer',
              payload: {
                from: user.id,
                to: peerId,
                sdp: offer,
                profile: { username: profile?.username, avatar_url: profile?.avatar_url },
              },
            });
          } catch {}
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            removePeer(peerId);
          }
        };

        const entry: PeerEntry = { pc, audio, remoteStream, pendingIce: [], remoteSet: false };
        peersRef.current[peerId] = entry;
        return entry;
      };

      const removePeer = (peerId: string) => {
        const entry = peersRef.current[peerId];
        if (!entry) return;
        try { entry.pc.close(); } catch {}
        entry.audio.srcObject = null;
        entry.audio.remove();
        delete peersRef.current[peerId];
        setPeers((p) => {
          const { [peerId]: _, ...rest } = p;
          return rest;
        });
      };

      const applyPendingIce = async (entry: PeerEntry) => {
        for (const c of entry.pendingIce) {
          try { await entry.pc.addIceCandidate(c); } catch {}
        }
        entry.pendingIce = [];
      };

      const sendOfferTo = async (peerId: string) => {
        const entry = peersRef.current[peerId] ?? createPeer(peerId);
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        chan.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            from: user.id,
            to: peerId,
            sdp: offer,
            profile: { username: profile?.username, avatar_url: profile?.avatar_url },
          },
        });
      };

      chan
        .on('broadcast', { event: 'hello' }, async ({ payload }) => {
          if (payload.from === user.id) return;
          setPeers((p) => ({
            ...p,
            [payload.from]: {
              ...(p[payload.from] || {}),
              username: payload.profile?.username,
              avatarUrl: payload.profile?.avatar_url,
            },
          }));
          // Deterministic offerer avoids glare with any number of peers.
          if (user.id < payload.from) {
            await sendOfferTo(payload.from);
          }
        })
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (payload.to !== user.id) return;
          setPeers((p) => ({
            ...p,
            [payload.from]: {
              ...(p[payload.from] || {}),
              username: payload.profile?.username,
              avatarUrl: payload.profile?.avatar_url,
            },
          }));
          const entry = peersRef.current[payload.from] ?? createPeer(payload.from);
          await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          entry.remoteSet = true;
          await applyPendingIce(entry);
          const answer = await entry.pc.createAnswer();
          await entry.pc.setLocalDescription(answer);
          chan.send({
            type: 'broadcast',
            event: 'answer',
            payload: {
              from: user.id,
              to: payload.from,
              sdp: answer,
              profile: { username: profile?.username, avatar_url: profile?.avatar_url },
            },
          });
        })
        .on('broadcast', { event: 'answer' }, async ({ payload }) => {
          if (payload.to !== user.id) return;
          const entry = peersRef.current[payload.from];
          if (!entry) return;
          if (entry.pc.signalingState === 'stable') return;
          await entry.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          entry.remoteSet = true;
          await applyPendingIce(entry);
        })
        .on('broadcast', { event: 'ice' }, async ({ payload }) => {
          if (payload.to !== user.id) return;
          const entry = peersRef.current[payload.from];
          if (!entry) return;
          if (!entry.remoteSet) {
            entry.pendingIce.push(payload.candidate);
            return;
          }
          try { await entry.pc.addIceCandidate(payload.candidate); } catch {}
        })
        .on('broadcast', { event: 'bye' }, ({ payload }) => {
          if (payload.from === user.id) return;
          removePeer(payload.from);
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED' || disposed) return;
          setJoined(true);
          setConnecting(false);
          chan.send({
            type: 'broadcast',
            event: 'hello',
            payload: {
              from: user.id,
              profile: { username: profile?.username, avatar_url: profile?.avatar_url },
            },
          });
        });
    };

    start();

    return () => {
      try {
        chanRef.current?.send({ type: 'broadcast', event: 'bye', payload: { from: user.id } });
      } catch {}
      cleanup();
    };
  }, [roomId, user, profile?.username, profile?.avatar_url]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  };

  const acquireCamera = async (mode: 'user' | 'environment') => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: mode }, width: 640, height: 480 },
        audio: false,
      });
    } catch {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: 640, height: 480 },
          audio: false,
        });
      } catch {
        return await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
      }
    }
  };

  const toggleVideo = async () => {
    if (!localStreamRef.current) return;
    const existing = localStreamRef.current.getVideoTracks()[0];
    if (existing) {
      // Turn off: stop and remove track, and null out senders.
      try { existing.stop(); } catch {}
      try { localStreamRef.current.removeTrack(existing); } catch {}
      Object.values(peersRef.current).forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) { try { sender.replaceTrack(null); } catch {} }
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setVideoOn(false);
      return;
    }
    try {
      const cam = await acquireCamera(facingMode);
      const track = cam.getVideoTracks()[0];
      if (!track) return;
      localStreamRef.current.addTrack(track);
      Object.values(peersRef.current).forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) { try { sender.replaceTrack(track); } catch {} }
        else { try { pc.addTrack(track, localStreamRef.current!); } catch {} }
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setVideoOn(true);
    } catch (e: any) {
      toast.error(e?.message || 'Could not turn on camera');
    }
  };

  const switchCamera = async () => {
    if (!videoOn || !localStreamRef.current) return;
    const next = facingMode === 'user' ? 'environment' : 'user';
    const old = localStreamRef.current.getVideoTracks()[0];
    // Stop old first so mobile can free the camera before opening the other.
    if (old) {
      try { old.stop(); } catch {}
      try { localStreamRef.current.removeTrack(old); } catch {}
    }
    try {
      const cam = await acquireCamera(next);
      const track = cam.getVideoTracks()[0];
      if (!track) throw new Error('No camera');
      localStreamRef.current.addTrack(track);
      Object.values(peersRef.current).forEach(({ pc }) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) { try { sender.replaceTrack(track); } catch {} }
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      setFacingMode(next);
    } catch (e: any) {
      toast.error(e?.message || 'Could not switch camera');
    }
  };

  const toggleSpeaker = async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    const audios = Object.values(peersRef.current).map((p) => p.audio);
    for (const el of audios) {
      const anyEl = el as any;
      if (typeof anyEl.setSinkId === 'function') {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const speaker = devices.find((d) => d.kind === 'audiooutput' && /speaker|loud/i.test(d.label));
          await anyEl.setSinkId(next ? speaker?.deviceId || 'default' : 'default');
        } catch {}
      } else {
        try { el.volume = next ? 1.0 : 0.6; } catch {}
      }
    }
  };

  const leave = () => navigate(-1);

  const copyLink = async () => {
    const url = `${window.location.origin}/meet/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Meeting link copied');
    } catch {
      toast.message(url);
    }
  };

  const peerIds = Object.keys(peers);
  const roomTitle = search.get('name') || 'Group meeting';
  const total = peerIds.length + 1;
  // Adaptive grid: 1 → single, 2 → 2 cols, 3-4 → 2 cols, 5-9 → 3 cols, 10+ → 4 cols.
  const gridCols =
    total <= 1 ? 'grid-cols-1' :
    total <= 4 ? 'grid-cols-2' :
    total <= 9 ? 'grid-cols-2 sm:grid-cols-3' :
    'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';

  const ctlBtn = 'h-12 w-12 sm:h-14 sm:w-14 rounded-full border-0 bg-white/10 hover:bg-white/20';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-white"
      style={{ height: '100dvh' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(1200px 600px at 50% -10%, hsl(var(--primary) / 0.35), transparent 60%), radial-gradient(800px 500px at 80% 100%, hsl(var(--accent) / 0.25), transparent 60%)',
        }}
      />

      <header
        className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/30 px-3 sm:px-4 py-3 backdrop-blur-xl"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs uppercase tracking-widest text-white/60">Meeting</p>
          <h1 className="text-base sm:text-lg font-semibold truncate">{roomTitle}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/70 shrink-0">
          <Users className="h-4 w-4" />
          <span>{total}</span>
          <Button
            variant="secondary"
            size="sm"
            className="ml-2 rounded-full border-0 bg-white/10 text-white hover:bg-white/20"
            onClick={copyLink}
          >
            <Link2 className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Copy link</span>
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto p-3 sm:p-6">
        <div className={`grid w-full max-w-5xl mx-auto gap-3 sm:gap-4 ${gridCols}`}>
          <ParticipantTile
            username={profile?.username || 'You'}
            avatarUrl={profile?.avatar_url}
            you
            muted={muted}
            videoOn={videoOn}
            localVideoRef={localVideoRef}
          />
          {peerIds.map((id) => (
            <ParticipantTile
              key={id}
              username={peers[id]?.username || 'Guest'}
              avatarUrl={peers[id]?.avatarUrl}
              stream={peers[id]?.stream}
            />
          ))}
        </div>
        {connecting && peerIds.length === 0 && (
          <div className="mt-6 text-center text-sm text-white/70">Setting up your mic…</div>
        )}
        {joined && !connecting && peerIds.length === 0 && (
          <div className="mt-6 text-center text-sm text-white/70">
            You're the only one here. Share the meeting link to invite more people.
          </div>
        )}
      </main>

      <div
        className="relative z-10 flex flex-wrap items-center justify-center gap-2 px-3 pb-3"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        <Button size="icon" variant="secondary" className={ctlBtn} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button size="icon" variant="secondary" className={ctlBtn} onClick={toggleVideo} aria-label={videoOn ? 'Turn off camera' : 'Turn on camera'}>
          {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        {videoOn && (
          <Button size="icon" variant="secondary" className={ctlBtn} onClick={switchCamera} aria-label="Switch camera">
            <SwitchCamera className="h-5 w-5" />
          </Button>
        )}
        <Button size="icon" variant="secondary" className={ctlBtn} onClick={toggleSpeaker} aria-label={speakerOn ? 'Speaker on' : 'Speaker off'} title="Speaker">
          {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </Button>
        <Button size="icon" variant="destructive" className="h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-lg" onClick={leave} aria-label="Leave meeting">
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}

function ParticipantTile({
  username,
  avatarUrl,
  you,
  muted,
  videoOn,
  localVideoRef,
  stream,
}: {
  username: string;
  avatarUrl?: string | null;
  you?: boolean;
  muted?: boolean;
  videoOn?: boolean;
  localVideoRef?: React.RefObject<HTMLVideoElement>;
  stream?: MediaStream;
}) {
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!you && remoteRef.current && stream) {
      remoteRef.current.srcObject = stream;
    }
  }, [stream, you]);

  const hasVideo = you ? videoOn : !!stream && stream.getVideoTracks().some((t) => t.enabled);
  const initial = (username || 'U').charAt(0).toUpperCase();

  return (
    <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
      {you ? (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full object-cover ${hasVideo ? 'block' : 'hidden'}`}
        />
      ) : (
        <video
          ref={remoteRef}
          autoPlay
          playsInline
          className={`absolute inset-0 h-full w-full object-cover ${hasVideo ? 'block' : 'hidden'}`}
        />
      )}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-white/20">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="bg-primary/20 text-2xl">{initial}</AvatarFallback>
          </Avatar>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 text-xs">
        <span className="truncate font-medium">{you ? `${username} (you)` : username}</span>
        {you && muted && <MicOff className="h-3 w-3 shrink-0" />}
      </div>
    </div>
  );
}
