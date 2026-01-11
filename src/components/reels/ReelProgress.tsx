import { useEffect, useState, useRef } from 'react';

interface ReelProgressProps {
  duration: number;
  isPlaying: boolean;
  onComplete?: () => void;
}

export function ReelProgress({ duration, isPlaying, onComplete }: ReelProgressProps) {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            onComplete?.();
            return 0;
          }
          return prev + (100 / (duration / 100));
        });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, duration, onComplete]);

  useEffect(() => {
    setProgress(0);
  }, [duration]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
      <div 
        className="h-full bg-white transition-all duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
