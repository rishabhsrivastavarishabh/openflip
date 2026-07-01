import { NotificationSettings } from '@/components/settings/NotificationSettings';

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold mb-1">Notifications</h2>
        <p className="text-sm text-muted-foreground">Choose what you want to be notified about.</p>
      </section>
      <NotificationSettings onBack={() => {}} hideHeader />
    </div>
  );
}
