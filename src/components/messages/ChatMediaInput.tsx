import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Camera, X, Eye, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface ChatMediaInputProps {
  onSend: (mediaUrl: string, mediaType: string, isViewOnce: boolean, caption?: string) => Promise<void>;
  disabled?: boolean;
}

export function ChatMediaInput({ onSend, disabled }: ChatMediaInputProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [showMenu, setShowMenu] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
    if (!type) {
      toast.error('Please select an image or video file');
      return;
    }

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }

    setSelectedMedia(file);
    setMediaType(type);
    setMediaPreviewUrl(URL.createObjectURL(file));
    setShowMenu(false);
  };

  const handleSendMedia = async () => {
    if (!selectedMedia || !user || !mediaType) return;

    setUploading(true);
    try {
      const fileName = `${Date.now()}_${selectedMedia.name}`;
      const filePath = `chat/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, selectedMedia);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      await onSend(publicUrl, mediaType, isViewOnce, caption || undefined);
      
      // Reset state
      setSelectedMedia(null);
      setMediaPreviewUrl(null);
      setMediaType(null);
      setIsViewOnce(false);
      setCaption('');
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error('Failed to send media');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedMedia(null);
    setMediaPreviewUrl(null);
    setMediaType(null);
    setIsViewOnce(false);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <>
      {/* Media Selection Menu */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowMenu(!showMenu)}
          disabled={disabled}
          className="shrink-0"
        >
          <ImageIcon className="w-5 h-5" />
        </Button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50"
            >
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors w-full"
              >
                <Camera className="w-5 h-5 text-primary" />
                <span>Camera</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors w-full"
              >
                <ImageIcon className="w-5 h-5 text-primary" />
                <span>Photo/Video</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Media Preview Modal */}
      <AnimatePresence>
        {selectedMedia && mediaPreviewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4">
              <button onClick={handleCancel}>
                <X className="w-6 h-6 text-white" />
              </button>
              <span className="text-white font-medium">
                {isViewOnce ? 'View Once' : 'Send Media'}
              </span>
              <div className="w-6" />
            </div>

            {/* Media Preview */}
            <div className="flex-1 flex items-center justify-center p-4">
              {mediaType === 'image' ? (
                <img
                  src={mediaPreviewUrl}
                  alt="Preview"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
                <video
                  src={mediaPreviewUrl}
                  controls
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              )}
            </div>

            {/* Controls */}
            <div className="p-4 space-y-4">
              {/* View Once Toggle */}
              <div className="flex items-center justify-between bg-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-white" />
                  <div>
                    <Label className="text-white">View Once</Label>
                    <p className="text-xs text-white/60">Photo/video can only be viewed once</p>
                  </div>
                </div>
                <Switch
                  checked={isViewOnce}
                  onCheckedChange={setIsViewOnce}
                />
              </div>

              {/* Caption Input */}
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add a caption..."
                className="w-full bg-white/10 text-white placeholder:text-white/50 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />

              {/* Send Button */}
              <Button
                onClick={handleSendMedia}
                disabled={uploading}
                className="w-full h-12"
                variant="gradient"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Send className="w-5 h-5 mr-2" />
                )}
                {uploading ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
