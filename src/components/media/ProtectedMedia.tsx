import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ProtectedMediaProps {
  src: string;
  type: 'image' | 'video';
  alt?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  poster?: string;
  onEnded?: () => void;
  onClick?: () => void;
}

export function ProtectedMedia({
  src,
  type,
  alt = '',
  className,
  autoPlay = false,
  muted = true,
  loop = false,
  controls = false,
  poster,
  onEnded,
  onClick,
}: ProtectedMediaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  // Prevent right-click context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  // Prevent drag
  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault();
    return false;
  };

  // Prevent touch hold save (best-effort)
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const preventLongPress = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        // Prevent default on long press
        const timer = setTimeout(() => {
          e.preventDefault();
        }, 500);
        
        const cleanup = () => {
          clearTimeout(timer);
          element.removeEventListener('touchend', cleanup);
          element.removeEventListener('touchmove', cleanup);
        };
        
        element.addEventListener('touchend', cleanup, { passive: true });
        element.addEventListener('touchmove', cleanup, { passive: true });
      }
    };

    element.addEventListener('touchstart', preventLongPress, { passive: false });
    
    return () => {
      element.removeEventListener('touchstart', preventLongPress);
    };
  }, []);

  // Disable pointer events on actual media to prevent save
  const mediaStyles = {
    pointerEvents: 'none' as const,
    userSelect: 'none' as const,
    WebkitUserSelect: 'none' as const,
    WebkitTouchCallout: 'none' as const,
  };

  if (type === 'video') {
    return (
      <div
        ref={containerRef}
        className={cn('relative overflow-hidden select-none', className)}
        onContextMenu={handleContextMenu}
        onClick={onClick}
        style={{ WebkitTouchCallout: 'none' }}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          playsInline
          controls={controls}
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onEnded={onEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className={cn('w-full h-full object-cover', className)}
          style={mediaStyles}
          onDragStart={handleDragStart}
        />
        {/* Overlay to intercept interactions */}
        {!controls && (
          <div 
            className="absolute inset-0" 
            onContextMenu={handleContextMenu}
            onClick={(e) => {
              e.stopPropagation();
              if (videoRef.current) {
                if (videoRef.current.paused) {
                  videoRef.current.play();
                } else {
                  videoRef.current.pause();
                }
              }
              onClick?.();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden select-none', className)}
      onContextMenu={handleContextMenu}
      onClick={onClick}
      style={{ WebkitTouchCallout: 'none' }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn('w-full h-full object-cover', className)}
        style={mediaStyles}
        onDragStart={handleDragStart}
        draggable={false}
      />
      {/* Transparent overlay to prevent right-click on image */}
      <div 
        className="absolute inset-0 bg-transparent" 
        onContextMenu={handleContextMenu}
      />
    </div>
  );
}
