import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, Music2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function CreateReel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [audioName, setAudioName] = useState('');
  const [audioArtist, setAudioArtist] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }

    if (selectedFile.size > 100 * 1024 * 1024) {
      toast.error('Video must be under 100MB');
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
      const fileName = `reels/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('reels')
        .insert({
          user_id: user.id,
          video_url: publicUrl,
          caption: caption.trim() || null,
          audio_name: audioName.trim() || null,
          audio_artist: audioArtist.trim() || null,
        });

      if (insertError) throw insertError;

      toast.success('Reel posted!');
      navigate('/reels');
    } catch (error) {
      console.error('Error creating reel:', error);
      toast.error('Failed to post reel');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button onClick={() => navigate(-1)}>
          <X className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold">New Reel</h1>
        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          size="sm"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* Video upload */}
        {preview ? (
          <div className="relative aspect-[9/16] max-w-sm mx-auto rounded-2xl overflow-hidden bg-black">
            <video
              src={preview}
              className="w-full h-full object-contain"
              controls
              autoPlay
              muted
              loop
            />
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="aspect-[9/16] max-w-sm mx-auto rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <Upload className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">Tap to upload video</p>
          </div>
        )}

        {/* Caption */}
        <div>
          <Textarea
            placeholder="Write a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            className="resize-none"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {caption.length}/2200
          </p>
        </div>

        {/* Audio info (display only) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Music2 className="w-4 h-4" />
            <span>Add audio info (optional)</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Song name"
              value={audioName}
              onChange={(e) => setAudioName(e.target.value)}
              maxLength={100}
            />
            <Input
              placeholder="Artist"
              value={audioArtist}
              onChange={(e) => setAudioArtist(e.target.value)}
              maxLength={100}
            />
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
