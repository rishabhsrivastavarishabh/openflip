/**
 * Device Management component for Settings.
 * Shows registered devices and allows removal.
 */

import { useState, useEffect } from 'react';
import { ArrowLeft, Smartphone, Monitor, Trash2, Shield, RefreshCw, Check, Loader2, AlertCircle } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { useDeviceKeys } from '@/hooks/useDeviceKeys';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

type ResetStep =
  | { kind: 'idle' }
  | { kind: 'removing'; label: string }
  | { kind: 'generating'; label: string }
  | { kind: 'registering'; label: string }
  | { kind: 'done'; label: string }
  | { kind: 'error'; label: string };

const STEP_ORDER: ResetStep['kind'][] = ['removing', 'generating', 'registering', 'done'];

const STEP_META: Record<Exclude<ResetStep['kind'], 'idle' | 'error'>, { label: string; hint: string }> = {
  removing: { label: 'Removing old keys', hint: 'Deleting this device from the encryption directory.' },
  generating: { label: 'Generating new keypair', hint: 'Creating a fresh X25519 keypair locally.' },
  registering: { label: 'Registering with the server', hint: 'Publishing the new public key so others can send you encrypted messages.' },
  done: { label: 'Encryption ready', hint: 'This device is set up. Newly received messages will decrypt automatically.' },
};

export function DeviceManagement({ onBack }: DeviceManagementProps) {
  const { deviceId, listDevices, removeDevice, reinitialize } = useDeviceKeys();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<ResetStep>({ kind: 'idle' });

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
    try {
      if (deviceId) {
        setStep({ kind: 'removing', label: STEP_META.removing.label });
        await removeDevice(deviceId);
      }
      setStep({ kind: 'generating', label: STEP_META.generating.label });
      // reinitialize handles both generation AND registration in one shot,
      // but we split the UI states so users see progress instead of a spinner.
      const registerPromise = reinitialize();
      // Give the UI a beat so the "Generating" step is visible even on fast devices.
      await new Promise((r) => setTimeout(r, 300));
      setStep({ kind: 'registering', label: STEP_META.registering.label });
      await registerPromise;
      setStep({ kind: 'done', label: STEP_META.done.label });
      await loadDevices();
      toast.success('Encryption keys regenerated for this device');
      setTimeout(() => setStep({ kind: 'idle' }), 2500);
    } catch (e: any) {
      const msg = e?.message || 'Failed to reset encryption';
      setStep({ kind: 'error', label: msg });
      toast.error(msg);
    }
  };

  const activeIdx = step.kind === 'idle' || step.kind === 'error' ? -1 : STEP_ORDER.indexOf(step.kind);
  const isRunning = step.kind !== 'idle' && step.kind !== 'done' && step.kind !== 'error';
  const progressPct = step.kind === 'done' ? 100 : Math.max(0, ((activeIdx + 0.5) / STEP_ORDER.length) * 100);

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
                  {/App|Mobile/i.test(device.device_name) ? (
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

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Set up encryption on this device</p>
              <p className="text-xs text-muted-foreground mt-1">
                Regenerate this device's encryption keys. Existing messages that were encrypted for the old key on this device will no longer be readable here.
              </p>
            </div>
          </div>

          {/* Live progress panel */}
          {step.kind !== 'idle' && (
            <div className="rounded-xl border border-border/60 bg-secondary/40 p-3 space-y-3">
              {step.kind === 'error' ? (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">Encryption setup failed</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.label}</p>
                  </div>
                </div>
              ) : (
                <>
                  <Progress value={progressPct} className="h-1.5" />
                  <ul className="space-y-2">
                    {STEP_ORDER.map((k, i) => {
                      const isActive = i === activeIdx;
                      const isDone = i < activeIdx || step.kind === 'done';
                      return (
                        <li key={k} className="flex items-start gap-2 text-xs">
                          <span
                            className={cn(
                              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                              isDone
                                ? 'bg-primary text-primary-foreground'
                                : isActive
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {isDone ? (
                              <Check className="h-3 w-3" />
                            ) : isActive ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            )}
                          </span>
                          <div className="flex-1">
                            <p className={cn('font-medium', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                              {STEP_META[k].label}
                            </p>
                            {isActive && (
                              <p className="text-[11px] text-muted-foreground">{STEP_META[k].hint}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isRunning} className="w-full">
                {isRunning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {isRunning ? 'Regenerating…' : step.kind === 'done' ? 'Run again' : 'Re-run encryption setup'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset encryption keys?</AlertDialogTitle>
                <AlertDialogDescription>
                  A fresh keypair will be generated for this device and registered with the server. Older encrypted messages on this device may become unreadable. Continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetEncryption}>Reset keys</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
