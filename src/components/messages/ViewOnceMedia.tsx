import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, X, Lock, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ViewOnceMediaProps {
  messageId: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  isViewed: boolean;
  isMine: boolean;
  senderId: string;
  onViewed?: () => void;
}

export function ViewOnceMedia({ 
  messageId, 
  mediaUrl, 
  mediaType, 
  isViewed, 
  isMine,
  senderId,
  onViewed 
}: ViewOnceMediaProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasViewed, setHasViewed] = useState(isViewed);
  const [countdown, setCountdown] = useState<number | null>(null);

  const canView = !isMine && !hasViewed;
  const showStatus = isMine;

  const handleOpen = async () => {
    if (!canView || !user) return;
    
    setIsOpen(true);
    
    // Start countdown
    setCountdown(5);
  };

  useEffect(() => {
    if (countdown === null || countdown < 0) return;

    if (countdown === 0) {
      handleClose();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const handleClose = async () => {
    setIsOpen(false);
    setCountdown(null);
    
    if (!hasViewed && user) {
      // Mark as viewed
      try {
        await (supabase as any)
          .from('messages')
          .update({ viewed_at: new Date().toISOString() })
          .eq('id', messageId);
        
        setHasViewed(true);
        
        // Create notification for sender
        await supabase.from('notifications').insert({
          user_id: senderId,
          actor_id: user.id,
          type: 'message',
        });
        
        onViewed?.();
      } catch (error) {
        console.error('Error marking view once as viewed:', error);
      }
    }
  };

  // Already viewed - show locked state
  if (hasViewed && !isMine) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-muted-foreground">
        <EyeOff className="w-4 h-4" />
        <span className="text-sm">Opened</span>
      </div>
    );
  }

  // Sender's view
  if (isMine) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
        <Eye className="w-4 h-4" />
        <span className="text-sm">
          View once {hasViewed ? '• Opened' : '• Not opened yet'}
        </span>
      </div>
    );
  }

  return (
    <>
      {/* Tap to view button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-3 bg-primary/20 rounded-xl border border-primary/30 hover:bg-primary/30 transition-colors"
      >
        <Eye className="w-5 h-5 text-primary" />
        <span className="text-sm font-medium">View once photo</span>
        <Lock className="w-3.5 h-3.5 text-primary/60" />
      </button>

      {/* Full screen viewer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4">
              <button onClick={handleClose}>
                <X className="w-6 h-6 text-white" />
              </button>
              <div className="flex items-center gap-2 text-white">
                <Eye className="w-4 h-4" />
                <span className="text-sm">View once</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white font-bold">{countdown}</span>
              </div>
            </div>

            {/* Media - Protected */}
            <div 
              className="flex-1 flex items-center justify-center p-4 select-none"
              style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
            >
              {mediaType === 'image' ? (
                <img
                  src={mediaUrl}
                  alt="View once"
                  className="max-w-full max-h-full object-contain rounded-lg pointer-events-none"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                />
              ) : (
                <video
                  src={mediaUrl}
                  autoPlay
                  muted
                  playsInline
                  className="max-w-full max-h-full object-contain rounded-lg pointer-events-none"
                  controlsList="nodownload"
                  disablePictureInPicture
                />
              )}
            </div>

            {/* Footer */}
            <div className="p-4 text-center">
              <p className="text-white/60 text-sm">
                This media will disappear after viewing
              </p>
            </div>

            {/* Screenshot prevention overlay */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{ 
                background: 'transparent',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
              } as React.CSSProperties}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
