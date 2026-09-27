import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  username: string;
}

/** Encodes ONLY the public profile URL — never sessions or credentials. */
export function publicProfileUrl(username: string) {
  const origin = typeof window !== 'undefined' && !window.location.hostname.includes('lovable')
    ? window.location.origin
    : 'https://www.openflip.in';
  return `${origin}/profile/${encodeURIComponent(username)}`;
}

export function ProfileQRCode({ open, onOpenChange, username }: Props) {
  const url = publicProfileUrl(username);
  const gradId = `qr-grad-${username}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share @{username}</DialogTitle>
          <DialogDescription>Scan to open this public profile on Openflip.</DialogDescription>
        </DialogHeader>
        <div className="mx-auto rounded-3xl p-1 gradient-primary">
          <div className="rounded-[1.3rem] bg-card p-5 flex flex-col items-center gap-3">
            <svg width="0" height="0" className="absolute">
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="hsl(245 80% 60%)" />
                  <stop offset="50%" stopColor="hsl(200 100% 45%)" />
                  <stop offset="100%" stopColor="hsl(280 80% 55%)" />
                </linearGradient>
              </defs>
            </svg>
            <div>
              <QRCodeSVG
                value={url}
                size={208}
                level="H"
                bgColor="transparent"
                fgColor={`url(#${gradId})`}
                imageSettings={{ src: '/icon-192.png', height: 40, width: 40, excavate: true }}
              />
            </div>
            <p className="font-semibold text-primary">@{username}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center break-all">{url}</p>
        <Button
          variant="secondary"
          onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Link copied'))}
        >
          Copy link
        </Button>
      </DialogContent>
    </Dialog>
  );
}
