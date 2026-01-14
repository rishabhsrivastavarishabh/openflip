import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface VerifiedBadgeProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export function VerifiedBadge({ className, size = 'sm', showTooltip = true }: VerifiedBadgeProps) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <span 
      className={cn("inline-flex items-center justify-center text-primary", className)}
      title={showTooltip ? "Verified Account" : undefined}
    >
      <CheckCircle2 className={cn(sizeClasses[size], "fill-primary text-primary-foreground")} />
    </span>
  );
}