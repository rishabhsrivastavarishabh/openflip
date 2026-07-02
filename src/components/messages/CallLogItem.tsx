import { Phone, PhoneOff, PhoneMissed, Video } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export interface CallLogEntry {
  id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'voice' | 'video' | string;
  status: string; // ringing, active, ended, missed, declined
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface Props {
  call: CallLogEntry;
  currentUserId: string;
  onCallBack?: (calleeId: string, type: 'voice' | 'video') => void;
}

function formatDuration(startISO: string | null, endISO: string | null): string | null {
  if (!startISO || !endISO) return null;
  const secs = Math.max(0, Math.floor((new Date(endISO).getTime() - new Date(startISO).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CallLogItem({ call, currentUserId, onCallBack }: Props) {
  const isOutgoing = call.caller_id === currentUserId;
  const isVideo = call.call_type === 'video';
  const missed = call.status === 'missed' || call.status === 'declined' || (call.status === 'ended' && !call.started_at);
  const duration = formatDuration(call.started_at, call.ended_at);

  const label = missed
    ? isOutgoing ? 'No answer' : 'Missed call'
    : isOutgoing ? 'Outgoing call' : 'Incoming call';

  const Icon = missed ? PhoneMissed : isVideo ? Video : Phone;

  const otherId = isOutgoing ? call.callee_id : call.caller_id;

  return (
    <div className="flex justify-center my-2">
      <button
        type="button"
        onClick={() => onCallBack?.(otherId, isVideo ? 'video' : 'voice')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors',
          missed
            ? 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20'
            : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
        )}
        aria-label={`${label} — tap to call back`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="font-medium">{isVideo ? 'Video' : 'Voice'} · {label}</span>
        {duration && <span className="opacity-70">· {duration}</span>}
        <span className="opacity-60">
          · {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
        </span>
      </button>
    </div>
  );
}
