import { useState, useEffect } from 'react';
import { ArrowLeft, Camera, Mic, MapPin, HardDrive, Bell, Vibrate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface PermissionState {
  camera: PermissionState_Status;
  microphone: PermissionState_Status;
  location: PermissionState_Status;
  notifications: PermissionState_Status;
}

type PermissionState_Status = 'granted' | 'denied' | 'prompt' | 'unsupported';

interface DevicePermissionsProps {
  onBack: () => void;
}

export function DevicePermissions({ onBack }: DevicePermissionsProps) {
  const [permissions, setPermissions] = useState<PermissionState>({
    camera: 'prompt',
    microphone: 'prompt',
    location: 'prompt',
    notifications: 'prompt',
  });
  const [vibration, setVibration] = useState(true);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const perms: Partial<PermissionState> = {};

    try {
      const camera = await navigator.permissions.query({ name: 'camera' as PermissionName });
      perms.camera = camera.state as PermissionState_Status;
      camera.onchange = () => setPermissions(p => ({ ...p, camera: camera.state as PermissionState_Status }));
    } catch { perms.camera = 'unsupported'; }

    try {
      const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      perms.microphone = mic.state as PermissionState_Status;
      mic.onchange = () => setPermissions(p => ({ ...p, microphone: mic.state as PermissionState_Status }));
    } catch { perms.microphone = 'unsupported'; }

    try {
      const geo = await navigator.permissions.query({ name: 'geolocation' });
      perms.location = geo.state as PermissionState_Status;
      geo.onchange = () => setPermissions(p => ({ ...p, location: geo.state as PermissionState_Status }));
    } catch { perms.location = 'unsupported'; }

    try {
      const notif = await navigator.permissions.query({ name: 'notifications' as PermissionName });
      perms.notifications = notif.state as PermissionState_Status;
      notif.onchange = () => setPermissions(p => ({ ...p, notifications: notif.state as PermissionState_Status }));
    } catch { perms.notifications = 'unsupported'; }

    setPermissions(p => ({ ...p, ...perms }));
  };

  const requestPermission = async (type: keyof PermissionState) => {
    try {
      switch (type) {
        case 'camera':
          await navigator.mediaDevices.getUserMedia({ video: true }).then(s => s.getTracks().forEach(t => t.stop()));
          toast.success('Camera access granted');
          break;
        case 'microphone':
          await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
          toast.success('Microphone access granted');
          break;
        case 'location':
          await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
          toast.success('Location access granted');
          break;
        case 'notifications':
          const result = await Notification.requestPermission();
          if (result === 'granted') toast.success('Notification access granted');
          else toast.info('Notification permission denied');
          break;
      }
      checkPermissions();
    } catch {
      toast.error(`Could not get ${type} permission. Check your browser settings.`);
      checkPermissions();
    }
  };

  const getStatusColor = (status: PermissionState_Status) => {
    switch (status) {
      case 'granted': return 'text-green-500';
      case 'denied': return 'text-destructive';
      case 'prompt': return 'text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusLabel = (status: PermissionState_Status) => {
    switch (status) {
      case 'granted': return 'Allowed';
      case 'denied': return 'Blocked';
      case 'prompt': return 'Not set';
      default: return 'Unsupported';
    }
  };

  const permissionItems = [
    { key: 'camera' as const, icon: Camera, label: 'Camera', desc: 'Take photos, record videos, video calls' },
    { key: 'microphone' as const, icon: Mic, label: 'Microphone', desc: 'Voice messages, reels audio, calls' },
    { key: 'location' as const, icon: MapPin, label: 'Location', desc: 'Tag location in posts and stories' },
    { key: 'notifications' as const, icon: Bell, label: 'Notifications', desc: 'Alerts for messages, likes, follows' },
  ];

  return (
    <div className="max-w-lg mx-auto">
      <header className="sticky top-0 z-40 glass-strong border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-semibold text-lg">Device Permissions</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Manage what Openflip can access on your device. Some features require specific permissions to work.
        </p>

        <div className="space-y-2">
          {permissionItems.map(({ key, icon: Icon, label, desc }) => {
            const status = permissions[key];
            return (
              <div key={key} className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <p className={`text-xs font-medium mt-0.5 ${getStatusColor(status)}`}>
                    {getStatusLabel(status)}
                  </p>
                </div>
                {status !== 'granted' && status !== 'unsupported' && (
                  <Button
                    size="sm"
                    variant={status === 'denied' ? 'outline' : 'default'}
                    onClick={() => requestPermission(key)}
                    className="flex-shrink-0"
                  >
                    {status === 'denied' ? 'Settings' : 'Allow'}
                  </Button>
                )}
                {status === 'granted' && (
                  <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Other</h3>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Storage</p>
              <p className="text-xs text-muted-foreground">Save photos and videos to device</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Vibrate className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Haptic Feedback</p>
              <p className="text-xs text-muted-foreground">Vibration on interactions</p>
            </div>
            <Switch checked={vibration} onCheckedChange={(v) => { setVibration(v); toast.success(v ? 'Haptics enabled' : 'Haptics disabled'); }} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-muted/50 mt-4">
          <p className="text-xs text-muted-foreground">
            If a permission shows as "Blocked", you'll need to update it in your browser or device settings. Openflip cannot change blocked permissions directly.
          </p>
        </div>
      </div>
    </div>
  );
}
