import { useState, useRef, useEffect } from 'react';
import { Mic, X, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { cn } from '@/lib/utils';

interface VoiceRecordButtonProps {
  onSend: (blob: Blob, duration: number) => void;
  disabled?: boolean;
}

export function VoiceRecordButton({ onSend, disabled }: VoiceRecordButtonProps) {
  const {
    isRecording,
    recordingDuration,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
  } = useVoiceRecorder();

  const [isHolding, setIsHolding] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressRef = useRef(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (disabled || isRecording) return;

    setIsHolding(true);
    longPressRef.current = false;

    holdTimerRef.current = setTimeout(() => {
      longPressRef.current = true;
      startRecording().catch(console.error);
    }, 200);
  };

  const handlePointerUp = async () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    setIsHolding(false);

    if (longPressRef.current && isRecording) {
      const blob = await stopRecording();
      if (blob && recordingDuration >= 1) {
        onSend(blob, recordingDuration);
      } else {
        resetRecording();
      }
    }
  };

  const handlePointerLeave = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isRecording) {
      cancelRecording();
    }
    setIsHolding(false);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  if (isRecording) {
    return (
      <div className="flex items-center gap-2 bg-destructive/10 rounded-full px-3 py-2 animate-pulse">
        <Button
          variant="ghost"
          size="icon"
          onClick={cancelRecording}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium text-destructive">
            {formatDuration(recordingDuration)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground ml-2">Release to send</span>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      className={cn(
        "shrink-0 touch-none select-none",
        isHolding && "scale-110 bg-primary text-primary-foreground"
      )}
    >
      <Mic className={cn("h-5 w-5", isHolding && "animate-pulse")} />
    </Button>
  );
}
