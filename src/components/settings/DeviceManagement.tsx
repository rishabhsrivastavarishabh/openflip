/**
 * Device Management component for Settings.
 * Shows registered devices and allows removal.
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Smartphone, Monitor, Trash2, Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeviceKeys } from '@/hooks/useDeviceKeys';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Device {
  id: string;
  device_name: string;
  device_public_key: string;
  created_at: string;
  last_seen_at: string;
}

interface DeviceManagementProps {
  onBack: () => void;
}

export function DeviceManagement({ onBack }: DeviceManagementProps) {
  const { deviceId, listDevices, removeDevice, reinitialize } = useDeviceKeys();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    const data = await listDevices();
    setDevices(data);
    setLoading(false);
  };

  const handleRemove = async (id: string) => {
    if (id === deviceId) {
      toast.error("Can't remove current device");
      return;
    }
    await removeDevice(id);
    toast.success('Device removed');
    loadDevices();
  };

  const handleResetEncryption = async () => {
    setResetting(true);
    try {
      // Remove the current device (which also wipes its local keypair) and
      // then reinitialize — that generates a fresh keypair and registers a
      // brand-new device with the server.
      if (deviceId) {
        await removeDevice(deviceId);
      } else {
        await reinitialize();
      }
      toast.success('Encryption keys regenerated for this device');
      await loadDevices();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to reset encryption');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">Device Management</h2>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Shield className="w-5 h-5 text-primary" />
            <p>Your messages are end-to-end encrypted. Each device has its own encryption keys. Private keys never leave your device.</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Devices</h3>
        
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No devices registered</p>
        ) : (
          devices.map(device => (
            <Card key={device.id} className={device.id === deviceId ? 'border-primary' : ''}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  {device.device_name.includes('Mobile') ? (
                    <Smartphone className="w-5 h-5 text-primary" />
                  ) : (
                    <Monitor className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{device.device_name}</p>
                    {device.id === deviceId && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">This device</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last active {formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true })}
                  </p>
                </div>
                {device.id !== deviceId && (
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(device.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
