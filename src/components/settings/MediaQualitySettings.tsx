import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Upload, Download, Wifi, Film, HardDrive, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface MediaQualitySettingsProps {
  onBack: () => void;
}

type Quality = 'low' | 'medium' | 'high' | 'original';

const QUALITY_OPTIONS: { value: Quality; label: string; desc: string }[] = [
  { value: 'low', label: 'Low', desc: 'Saves data, lower resolution' },
  { value: 'medium', label: 'Medium', desc: 'Balanced quality and data usage' },
  { value: 'high', label: 'High', desc: 'Great quality, uses more data' },
  { value: 'original', label: 'Original', desc: 'Full resolution, maximum data' },
];

export function MediaQualitySettings({ onBack }: MediaQualitySettingsProps) {
  const [uploadQuality, setUploadQuality] = useState<Quality>(() =>
    (localStorage.getItem('of_upload_quality') as Quality) || 'high'
  );
  const [downloadQuality, setDownloadQuality] = useState<Quality>(() =>
    (localStorage.getItem('of_download_quality') as Quality) || 'high'
  );
  const [dataSaver, setDataSaver] = useState(() =>
    localStorage.getItem('of_data_saver') === 'true'
  );
  const [autoPlay, setAutoPlay] = useState(() =>
    localStorage.getItem('of_autoplay') !== 'false'
  );
  const [hdReels, setHdReels] = useState(() =>
    localStorage.getItem('of_hd_reels') !== 'false'
  );

  const savePreference = (key: string, value: string) => {
    localStorage.setItem(key, value);
  };

  const handleUploadQuality = (q: Quality) => {
    setUploadQuality(q);
    savePreference('of_upload_quality', q);
    toast.success(`Upload quality set to ${q}`);
  };

  const handleDownloadQuality = (q: Quality) => {
    setDownloadQuality(q);
    savePreference('of_download_quality', q);
    toast.success(`Download quality set to ${q}`);
  };

  const handleDataSaver = (enabled: boolean) => {
    setDataSaver(enabled);
    savePreference('of_data_saver', String(enabled));
    if (enabled) {
      setUploadQuality('medium');
      setDownloadQuality('low');
      setAutoPlay(false);
      setHdReels(false);
      savePreference('of_upload_quality', 'medium');
      savePreference('of_download_quality', 'low');
      savePreference('of_autoplay', 'false');
      savePreference('of_hd_reels', 'false');
      toast.success('Data saver enabled – quality settings adjusted');
    } else {
      toast.success('Data saver disabled');
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Media Quality</h1>
        </div>
      </header>

      <div className="p-4 space-y-6">
        {/* Data Saver */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Wifi className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Data Saver</p>
            <p className="text-xs text-muted-foreground">Reduce data usage across the app</p>
          </div>
          <Switch checked={dataSaver} onCheckedChange={handleDataSaver} />
        </div>

        {/* Upload Quality */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upload Quality</h3>
          </div>
          <p className="text-xs text-muted-foreground px-1">Quality for photos and videos you post</p>
          <div className="grid grid-cols-2 gap-2">
            {QUALITY_OPTIONS.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => handleUploadQuality(value)}
                disabled={dataSaver}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  uploadQuality === value
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border hover:bg-secondary disabled:opacity-50'
                }`}
              >
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Download Quality */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Download className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Download & Viewing Quality</h3>
          </div>
          <p className="text-xs text-muted-foreground px-1">Quality when viewing content in your feed</p>
          <div className="grid grid-cols-2 gap-2">
            {QUALITY_OPTIONS.filter(o => o.value !== 'original').map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => handleDownloadQuality(value)}
                disabled={dataSaver}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  downloadQuality === value
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border hover:bg-secondary disabled:opacity-50'
                }`}
              >
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Video Settings */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Film className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Video</h3>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Autoplay Videos</p>
              <p className="text-xs text-muted-foreground">Automatically play videos in feed</p>
            </div>
            <Switch
              checked={autoPlay}
              disabled={dataSaver}
              onCheckedChange={(v) => {
                setAutoPlay(v);
                savePreference('of_autoplay', String(v));
                toast.success(v ? 'Autoplay enabled' : 'Autoplay disabled');
              }}
            />
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">HD Reels</p>
              <p className="text-xs text-muted-foreground">Load reels in high definition</p>
            </div>
            <Switch
              checked={hdReels}
              disabled={dataSaver}
              onCheckedChange={(v) => {
                setHdReels(v);
                savePreference('of_hd_reels', String(v));
                toast.success(v ? 'HD Reels enabled' : 'HD Reels disabled');
              }}
            />
          </div>
        </div>

        {dataSaver && (
          <div className="p-4 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground">
              Data saver is active. Individual quality settings are overridden to save data. Disable data saver to customize them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
