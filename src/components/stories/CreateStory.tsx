import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Upload, Camera, Video, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateStoryProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateStory({ onClose, onCreated }: CreateStoryProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Please select an image or video file');
      return;
    }

    // Validate file size (50MB max for videos, 10MB for images)
    const maxSize = selectedFile.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error('File is too large');
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      const { error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id: user.id,
          media_url: publicUrl,
          media_type: mediaType,
          duration: mediaType === 'video' ? 30 : 5,
        });

      if (insertError) throw insertError;

      toast.success('Story created!');
      onCreated();
      onClose();
    } catch (error) {
      console.error('Error creating story:', error);
      toast.error('Failed to create story');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={onClose}>
          <X className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">Create Story</h1>
        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          size="sm"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Share'
          )}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        {preview ? (
          <div className="relative max-w-sm w-full aspect-[9/16] rounded-2xl overflow-hidden bg-black">
            {file?.type.startsWith('video/') ? (
              <video
                src={preview}
                className="w-full h-full object-contain"
                controls
                autoPlay
                muted
                loop
              />
            ) : (
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            )}
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-48 h-48 rounded-full bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
            >
              <Upload className="w-12 h-12 text-muted-foreground" />
            </div>
            <div className="flex gap-4">
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.click();
                  }
                }}
              >
                <Camera className="w-5 h-5 mr-2" />
                Photo
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'video/*';
                    fileInputRef.current.click();
                  }
                }}
              >
                <Video className="w-5 h-5 mr-2" />
                Video
              </Button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </motion.div>
  );
}
