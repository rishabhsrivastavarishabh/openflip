import { cn } from '@/lib/utils';

interface StoryRingProps {
  hasUnviewed: boolean;
  size?: 'sm' | 'md' | 'lg';
  isOwn?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
};

const ringPadding = {
  sm: 'p-0.5',
  md: 'p-0.5',
  lg: 'p-1',
};

export function StoryRing({ hasUnviewed, size = 'md', isOwn, children, onClick }: StoryRingProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative rounded-full transition-transform hover:scale-105 active:scale-95',
        sizeClasses[size],
        ringPadding[size],
        hasUnviewed
          ? 'bg-gradient-to-tr from-primary via-accent to-primary-glow'
          : isOwn
          ? 'bg-muted'
          : 'bg-border'
      )}
    >
      <div className="w-full h-full rounded-full bg-background p-0.5">
        {children}
      </div>
      {isOwn && !hasUnviewed && (
        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-background">
          <span className="text-primary-foreground text-xs font-bold">+</span>
        </div>
      )}
    </button>
  );
}
