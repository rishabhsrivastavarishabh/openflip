import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  username: string;
}

export function ProfilePhotoViewer({ open, onOpenChange, imageUrl, username }: Props) {
  const [scale, setScale] = useState(1);
  const lastDistance = useRef(0);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (lastDistance.current > 0) {
        const delta = distance / lastDistance.current;
        setScale(prev => Math.min(3, Math.max(1, prev * delta)));
      }
      lastDistance.current = distance;
    }
  };

  const handleTouchEnd = () => {
    lastDistance.current = 0;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); setScale(1); }}>
      <DialogContent className="max-w-full h-full max-h-full p-0 bg-black border-none rounded-none [&>button]:hidden">
        <div
          className="relative w-full h-full flex items-center justify-center"
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={username}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${scale})` }}
              draggable={false}
            />
          ) : (
            <div className="w-48 h-48 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-6xl text-white font-bold">{username.charAt(0).toUpperCase()}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
