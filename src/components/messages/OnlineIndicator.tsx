import { cn } from '@/lib/utils';

interface OnlineIndicatorProps {
  isOnline: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function OnlineIndicator({ isOnline, size = 'md', className }: OnlineIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={cn(
        'rounded-full border-2 border-background',
        sizeClasses[size],
        isOnline ? 'bg-green-500' : 'bg-muted-foreground/50',
        className
      )}
    />
  );
}
