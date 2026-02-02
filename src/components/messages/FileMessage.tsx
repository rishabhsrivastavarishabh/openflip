import { Download, FileText, Image, Film, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileMessageProps {
  mediaUrl: string;
  mediaType: string;
  fileName?: string;
  fileSize?: number;
  isMine: boolean;
}

export function FileMessage({ mediaUrl, mediaType, fileName, fileSize, isMine }: FileMessageProps) {
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = fileName || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (mediaType === 'image') {
    return (
      <div className="relative group">
        <img
          src={mediaUrl}
          alt={fileName || 'Image'}
          className="max-w-[280px] rounded-lg cursor-pointer"
          onClick={() => window.open(mediaUrl, '_blank')}
        />
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className="relative group">
        <video
          src={mediaUrl}
          controls
          className="max-w-[280px] rounded-lg"
        />
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Document type
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg min-w-[200px]",
      isMine ? "bg-primary-foreground/10" : "bg-background"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center",
        "bg-primary/10"
      )}>
        <FileText className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          isMine ? "text-primary-foreground" : "text-foreground"
        )}>
          {fileName || 'Document'}
        </p>
        {fileSize && (
          <p className={cn(
            "text-xs",
            isMine ? "text-primary-foreground/70" : "text-muted-foreground"
          )}>
            {formatFileSize(fileSize)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => window.open(mediaUrl, '_blank')}
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
