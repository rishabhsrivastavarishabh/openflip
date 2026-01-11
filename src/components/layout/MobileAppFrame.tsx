import { cn } from '@/lib/utils';

interface MobileAppFrameProps {
  children: React.ReactNode;
  className?: string;
  fullBleed?: boolean;
}

export function MobileAppFrame({ children, className, fullBleed }: MobileAppFrameProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-0 md:p-4">
      {/* Desktop: Centered phone frame */}
      <div className={cn(
        "relative w-full h-screen md:h-auto md:max-h-[90vh] md:max-w-[420px] md:rounded-3xl md:shadow-2xl md:border md:border-border/50",
        "md:overflow-hidden md:bg-background",
        fullBleed ? "bg-black" : "bg-background",
        className
      )}>
        {/* Phone notch indicator for desktop */}
        <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-50" />
        
        {/* Content */}
        <div className={cn(
          "h-full overflow-hidden",
          !fullBleed && "md:pt-6"
        )}>
          {children}
        </div>
      </div>
    </div>
  );
}
