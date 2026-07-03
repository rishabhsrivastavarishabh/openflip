import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Mic, MicOff, PhoneOff, Link2, Users } from 'lucide-react';
import { toast } from 'sonner';

// Free public STUN. For symmetric NATs a TURN server is needed — can be plugged
// in later without changing the signaling shape.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const MAX_PEERS = 3; // room caps at 4 people (me + 3 remotes) — mesh audio only.

type PeerEntry = {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
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
  const [peers, setPeers] = useState<Record<string, { username?: string; avatarUrl?: string }>>({});
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(true);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, PeerEntry>>({});
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const meIdRef = useRef<string>('');

  useEffect(() => {
    if (!roomId || !user) return;
    meIdRef.current = user.id;
    let disposed = false;

    const cleanup = () => {
      disposed = true;
      Object.values(peersRef.current).forEach(({ pc, audio }) => {
        try {
          pc.close();
        } catch {}
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
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const audio = document.createElement('audio');
        audio.autoplay = true;
        document.body.appendChild(audio);

        pc.ontrack = (ev) => {
          audio.srcObject = ev.streams[0];
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
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            removePeer(peerId);
          }
        };

        const entry: PeerEntry = { pc, audio, pendingIce: [], remoteSet: false };
        peersRef.current[peerId] = entry;
        return entry;
      };

      const removePeer = (peerId: string) => {
        const entry = peersRef.current[peerId];
        if (!entry) return;
        try {
          entry.pc.close();
        } catch {}
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
          try {
            await entry.pc.addIceCandidate(c);
          } catch {}
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
          if (Object.keys(peersRef.current).length >= MAX_PEERS) return;
          setPeers((p) => ({
            ...p,
            [payload.from]: { username: payload.profile?.username, avatarUrl: payload.profile?.avatar_url },
          }));
          // Deterministic offerer: whichever id is lexicographically smaller sends the offer.
          if (user.id < payload.from) {
            await sendOfferTo(payload.from);
          }
        })
        .on('broadcast', { event: 'offer' }, async ({ payload }) => {
          if (payload.to !== user.id) return;
          if (Object.keys(peersRef.current).length >= MAX_PEERS && !peersRef.current[payload.from]) {
            return;
          }
          setPeers((p) => ({
            ...p,
            [payload.from]: { username: payload.profile?.username, avatarUrl: payload.profile?.avatar_url },
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
          try {
            await entry.pc.addIceCandidate(payload.candidate);
          } catch {}
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
      // Say goodbye so peers tear down our pc immediately.
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(1200px 600px at 50% -10%, hsl(var(--primary) / 0.35), transparent 60%), radial-gradient(800px 500px at 80% 100%, hsl(var(--accent) / 0.25), transparent 60%)',
        }}
      />

      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-3 backdrop-blur-xl">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Meeting</p>
          <h1 className="text-lg font-semibold">{roomTitle}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Users className="h-4 w-4" />
          <span>{peerIds.length + 1}/4</span>
          <Button
            variant="secondary"
            size="sm"
            className="ml-2 rounded-full border-0 bg-white/10 text-white hover:bg-white/20"
            onClick={copyLink}
          >
            <Link2 className="mr-1 h-4 w-4" /> Copy link
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center p-6">
        <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <ParticipantTile
            username={profile?.username || 'You'}
            avatarUrl={profile?.avatar_url}
            you
            muted={muted}
          />
          {peerIds.map((id) => (
            <ParticipantTile
              key={id}
              username={peers[id]?.username || 'Guest'}
              avatarUrl={peers[id]?.avatarUrl}
            />
          ))}
          {connecting && peerIds.length === 0 && (
            <div className="col-span-full text-center text-sm text-white/70">Setting up your mic…</div>
          )}
          {joined && !connecting && peerIds.length === 0 && (
            <div className="col-span-full text-center text-sm text-white/70">
              You're the only one here. Share the meeting link to invite up to 3 more people.
            </div>
          )}
        </div>
      </main>

      <div className="relative z-10 mb-8 flex items-center justify-center gap-4">
        <Button
          size="icon"
          variant="secondary"
          className="h-14 w-14 rounded-full border-0 bg-white/10 hover:bg-white/20"
          onClick={toggleMute}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Button
          size="icon"
          variant="destructive"
          className="h-16 w-16 rounded-full shadow-lg"
          onClick={leave}
          aria-label="Leave meeting"
        >
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
}: {
  username: string;
  avatarUrl?: string | null;
  you?: boolean;
  muted?: boolean;
}) {
  const initial = (username || 'U').charAt(0).toUpperCase();
  return (
    <div className="relative flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <Avatar className="h-20 w-20 ring-2 ring-white/20">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="bg-primary/20 text-2xl">{initial}</AvatarFallback>
      </Avatar>
      <div className="text-center">
        <p className="text-sm font-medium">{you ? `${username} (you)` : username}</p>
        {you && muted && (
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-white/60">
            <MicOff className="h-3 w-3" /> Muted
          </p>
        )}
      </div>
    </div>
  );
}
