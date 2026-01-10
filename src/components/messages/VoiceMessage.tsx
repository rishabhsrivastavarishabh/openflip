import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceMessageProps {
  audioUrl: string;
  duration?: number;
  isMine?: boolean;
}

export function VoiceMessage({ audioUrl, duration = 0, isMine }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Generate random waveform data for visualization
    const bars = 30;
    const data = Array.from({ length: bars }, () => Math.random() * 0.7 + 0.3);
    setWaveformData(data);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className={cn(
          "h-10 w-10 rounded-full shrink-0",
          isMine ? "bg-primary-foreground/20 hover:bg-primary-foreground/30" : "bg-primary/10 hover:bg-primary/20"
        )}
      >
        {isPlaying ? (
          <Pause className={cn("h-5 w-5", isMine ? "text-primary-foreground" : "text-primary")} />
        ) : (
          <Play className={cn("h-5 w-5", isMine ? "text-primary-foreground" : "text-primary")} />
        )}
      </Button>

      <div className="flex-1 flex flex-col gap-1">
        {/* Waveform visualization */}
        <div className="flex items-center gap-0.5 h-6">
          {waveformData.map((height, i) => {
            const barProgress = (i / waveformData.length) * 100;
            const isActive = barProgress <= progress;
            
            return (
              <div
                key={i}
                className={cn(
                  "w-1 rounded-full transition-all",
                  isMine
                    ? isActive ? "bg-primary-foreground" : "bg-primary-foreground/40"
                    : isActive ? "bg-primary" : "bg-primary/40"
                )}
                style={{ height: `${height * 100}%` }}
              />
            );
          })}
        </div>

        {/* Duration */}
        <span className={cn(
          "text-xs",
          isMine ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {formatTime(isPlaying ? currentTime : audioDuration)}
        </span>
      </div>
    </div>
  );
}
