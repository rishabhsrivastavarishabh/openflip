import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { cn } from '@/lib/utils';
import {
  User,
  Shield,
  Lock,
  Bell,
  Palette,
  ChevronRight,
  Settings2,
} from 'lucide-react';

const sections = [
  { to: '/settings/account', label: 'Account', icon: User, desc: 'Profile, username, email' },
  { to: '/settings/security', label: 'Security', icon: Shield, desc: 'Password, 2FA, delete account' },
  { to: '/settings/privacy', label: 'Privacy', icon: Lock, desc: 'Who can see and contact you' },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell, desc: 'Push and email preferences' },
  { to: '/settings/appearance', label: 'Appearance', icon: Palette, desc: 'Theme and display' },
  { to: '/settings/more', label: 'More settings', icon: Settings2, desc: 'Creator tools, subscription, business' },
];

export default function SettingsLayout() {
  const location = useLocation();

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto w-full">
        <header className="sticky top-0 z-30 glass-strong border-b px-4 py-3">
          <h1 className="font-semibold text-lg">Settings</h1>
        </header>

        <div className="md:grid md:grid-cols-[240px_1fr] md:gap-6 md:p-4">
          {/* Sidebar (desktop) / Tab list (mobile) */}
          <nav
            aria-label="Settings sections"
            className="md:sticky md:top-16 md:self-start md:h-fit"
          >
            {/* Mobile: horizontal scrollable tabs */}
            <div className="md:hidden flex gap-2 overflow-x-auto px-4 py-2 border-b no-scrollbar">
              {sections.map((s) => {
                const active = location.pathname === s.to || location.pathname.startsWith(s.to + '/');
                return (
                  <NavLink
                    key={s.to}
                    to={s.to}
                    className={cn(
                      'shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-secondary border-border',
                    )}
                  >
                    {s.label}
                  </NavLink>
                );
              })}
            </div>

            {/* Desktop: vertical sidebar */}
            <ul className="hidden md:flex flex-col gap-1 p-2 rounded-2xl bg-secondary/40 border">
              {sections.map((s) => {
                const active = location.pathname === s.to || location.pathname.startsWith(s.to + '/');
                const Icon = s.icon;
                return (
                  <li key={s.to}>
                    <NavLink
                      to={s.to}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors group',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-secondary text-foreground',
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{s.label}</div>
                        <div className={cn('text-xs truncate', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                          {s.desc}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-60" />
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          <main className="p-4 md:p-0">
            <Outlet />
          </main>
        </div>
      </div>
    </MainLayout>
  );
}
