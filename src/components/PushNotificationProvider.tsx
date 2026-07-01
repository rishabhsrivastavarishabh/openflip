import { usePushNotifications } from '@/hooks/usePushNotifications';
import { IncomingCallDialog } from '@/components/calls/IncomingCallDialog';
import { useAuth } from '@/contexts/AuthContext';

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  usePushNotifications();
  const { user } = useAuth();
  return (
    <>
      {children}
      {user ? <IncomingCallDialog /> : null}
    </>
  );
}
