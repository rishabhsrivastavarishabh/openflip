import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  User,
  Shield,
  Lock,
  Bell,
  Phone,
  Palette,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

const baseSections = [
  { to: '/settings/account', label: 'Account', icon: User, desc: 'Profile, username, email' },
  { to: '/settings/security', label: 'Security', icon: Shield, desc: 'Password, 2FA, delete account' },
  { to: '/settings/privacy', label: 'Privacy', icon: Lock, desc: 'Who can see and contact you' },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell, desc: 'Push and email preferences' },
  { to: '/settings/calls', label: 'Calls', icon: Phone, desc: 'Ringtone, caller tune, call behaviour' },
  { to: '/settings/appearance', label: 'Appearance', icon: Palette, desc: 'Theme and display' },
];

export default function SettingsLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const sections = isAdmin
    ? [
        ...baseSections,
        { to: '/settings/admin', label: 'Admin', icon: ShieldCheck, desc: 'Verifications, promos, subscribers' },
      ]
    : baseSections;


  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto w-full">
        <header className="sticky top-0 z-30 header-glow px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
              <Settings2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight">Settings</h1>
              <p className="text-xs text-muted-foreground">Manage your account and preferences</p>
            </div>
          </div>
        </header>

        <div className="md:grid md:grid-cols-[260px_1fr] md:gap-6 md:p-4">
          {/* Sidebar (desktop) / Tab list (mobile) */}
          <nav
            aria-label="Settings sections"
            className="md:sticky md:top-24 md:self-start md:h-fit"
          >
            {/* Mobile: horizontal scrollable pill tabs */}
            <div className="md:hidden flex gap-2 overflow-x-auto px-4 py-3 border-b border-border/40 no-scrollbar">
              {sections.map((s) => {
                const active = location.pathname === s.to || location.pathname.startsWith(s.to + '/');
                return (
                  <NavLink
                    key={s.to}
                    to={s.to}
                    className={cn(
                      'shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
                      active
                        ? 'gradient-primary text-primary-foreground border-transparent shadow-glow'
                        : 'glass-tile hover:bg-secondary/70',
                    )}
                  >
                    {s.label}
                  </NavLink>
                );
              })}
            </div>

            {/* Desktop: glass sidebar card */}
            <ul className="hidden md:flex flex-col gap-1 p-2 glass-card">
              {sections.map((s) => {
                const active = location.pathname === s.to || location.pathname.startsWith(s.to + '/');
                const Icon = s.icon;
                return (
                  <li key={s.to}>
                    <NavLink
                      to={s.to}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition-all group',
                        active
                          ? 'gradient-primary text-primary-foreground shadow-glow'
                          : 'hover:bg-secondary/70 text-foreground',
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                        active ? 'bg-white/20' : 'bg-secondary/60 group-hover:bg-secondary',
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
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
