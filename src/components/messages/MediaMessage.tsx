import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaMessageProps {
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  isMine: boolean;
}

export function MediaMessage({ mediaUrl, mediaType, caption, isMine }: MediaMessageProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <>
      <div className="space-y-1">
        <button
          onClick={() => setIsFullscreen(true)}
          className="relative block overflow-hidden rounded-xl max-w-[240px]"
        >
          {mediaType === 'image' ? (
            <img
              src={mediaUrl}
              alt="Media"
              className="w-full h-auto max-h-[300px] object-cover"
            />
          ) : (
            <div className="relative">
              <video
                src={mediaUrl}
                className="w-full h-auto max-h-[300px] object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
                  <Play className="w-6 h-6 text-black ml-0.5" fill="black" />
                </div>
              </div>
            </div>
          )}
        </button>
        
        {caption && (
          <p className={cn(
            "text-sm px-1",
            isMine ? "text-primary-foreground/90" : "text-foreground"
          )}>
            {caption}
          </p>
        )}
      </div>

      {/* Fullscreen View */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
            onClick={() => setIsFullscreen(false)}
          >
            <div className="flex items-center justify-between p-4">
              <button onClick={() => setIsFullscreen(false)}>
                <X className="w-6 h-6 text-white" />
              </button>
              <a
                href={mediaUrl}
                download
                onClick={(e) => e.stopPropagation()}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <Download className="w-5 h-5 text-white" />
              </a>
            </div>

            <div 
              className="flex-1 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {mediaType === 'image' ? (
                <img
                  src={mediaUrl}
                  alt="Media"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <video
                  src={mediaUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-full"
                />
              )}
            </div>

            {caption && (
              <div className="p-4 text-center text-white">
                {caption}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}