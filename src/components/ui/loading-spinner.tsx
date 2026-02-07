import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const dims = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <div className={cn('twin-zigzag-spinner', dims)}>
        <div className="zigzag-ring ring-a" />
        <div className="zigzag-ring ring-b" />
      </div>
      {text && (
        <p className="mt-3 text-sm text-muted-foreground animate-fade-in">
          {text}
        </p>
      )}
    </div>
  );
}

export function FullPageLoader({ text }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

export function InlineLoader({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <LoadingSpinner size="md" />
    </div>
  );
}
