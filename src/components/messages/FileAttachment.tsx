import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Paperclip, Image, FileText, Film, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FileAttachmentProps {
  onFileUploaded: (url: string, type: string, fileName: string, fileSize: number) => void;
  disabled?: boolean;
}

interface FilePreview {
  file: File;
  preview: string;
  type: 'image' | 'video' | 'document';
}

export function FileAttachment({ onFileUploaded, disabled }: FileAttachmentProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    let previewUrl = '';
    if (type === 'image' || type === 'video') {
      previewUrl = URL.createObjectURL(file);
    }

    setPreview({ file, preview: previewUrl, type });
    setOpen(false);
  };

  const clearPreview = () => {
    if (preview?.preview) {
      URL.revokeObjectURL(preview.preview);
    }
    setPreview(null);
  };

  const uploadFile = async () => {
    if (!preview || !user) return;

    setUploading(true);
    try {
      const ext = preview.file.name.split('.').pop();
      const fileName = `${Date.now()}_${preview.file.name}`;
      const path = `attachments/${user.id}/${fileName}`;

      const { error } = await supabase.storage.from('media').upload(path, preview.file);
      if (error) throw error;

      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
      
      onFileUploaded(urlData.publicUrl, preview.type, preview.file.name, preview.file.size);
      clearPreview();
    } catch (error: any) {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (preview) {
    return (
      <div className="relative">
        <div className="p-2 bg-muted rounded-lg flex items-center gap-3">
          {preview.type === 'image' && (
            <img src={preview.preview} alt="Preview" className="w-16 h-16 object-cover rounded" />
          )}
          {preview.type === 'video' && (
            <video src={preview.preview} className="w-16 h-16 object-cover rounded" />
          )}
          {preview.type === 'document' && (
            <div className="w-16 h-16 bg-primary/10 rounded flex items-center justify-center">
              <FileText className="w-8 h-8 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{preview.file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(preview.file.size)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={clearPreview} disabled={uploading}>
            <X className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={uploadFile} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileSelect(e, 'image')}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        onChange={(e) => handleFileSelect(e, 'video')}
        className="hidden"
      />
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
        onChange={(e) => handleFileSelect(e, 'document')}
        className="hidden"
      />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" disabled={disabled}>
            <Paperclip className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1">
            <button
              onClick={() => imageInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
                <Image className="w-5 h-5 text-green-500" />
              </div>
              <span className="font-medium">Photo</span>
            </button>
            <button
              onClick={() => videoInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                <Film className="w-5 h-5 text-blue-500" />
              </div>
              <span className="font-medium">Video</span>
            </button>
            <button
              onClick={() => documentInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-500" />
              </div>
              <span className="font-medium">Document</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
