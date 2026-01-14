import { Clock } from 'lucide-react';

interface DisappearingMessagesIndicatorProps {
  timer: number; // in hours
}

export function DisappearingMessagesIndicator({ timer }: DisappearingMessagesIndicatorProps) {
  const getTimerLabel = () => {
    if (timer === 24) return '24 hours';
    if (timer === 168) return '7 days';
    if (timer === 720) return '30 days';
    return `${timer} hours`;
  };

  return (
    <div className="flex items-center justify-center gap-2 py-2 px-3 bg-muted/50 rounded-full text-xs text-muted-foreground mx-auto w-fit">
      <Clock className="w-3 h-3" />
      <span>Messages disappear after {getTimerLabel()}</span>
    </div>
  );
}