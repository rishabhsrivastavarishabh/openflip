import { usePushNotifications } from '@/hooks/usePushNotifications';

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  // Initialize push notifications
  usePushNotifications();
  
  return <>{children}</>;
}
