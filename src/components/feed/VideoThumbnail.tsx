import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Film } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoThumbnailProps {
  postId: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  className?: string;
}

export function VideoThumbnail({ postId, videoUrl, thumbnailUrl, className }: VideoThumbnailProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Navigate to reels page with this video
  const reelsUrl = `/reels?start=${postId}`;

  return (
    <Link 
      to={reelsUrl}
      className={cn(
        "relative block aspect-square bg-muted rounded-lg overflow-hidden group cursor-pointer",
        className
      )}
    >
      {/* Thumbnail or Video Frame */}
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
          onLoad={() => setImageLoaded(true)}
        />
      ) : (
        <video
          src={videoUrl}
          className="w-full h-full object-cover"
          preload="metadata"
        />
      )}

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
        <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
          <Play className="w-6 h-6 text-white fill-white ml-0.5" />
        </div>
      </div>

      {/* Reel indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
        <Film className="w-3 h-3 text-white" />
        <span className="text-white text-xs font-medium">Reel</span>
      </div>
    </Link>
  );
}
