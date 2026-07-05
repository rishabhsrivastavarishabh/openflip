import { Home, Clapperboard, MessagesSquare, PlusCircle } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AccountSwitcher } from '@/components/account/AccountSwitcher';

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { unreadMessages } = useUnreadCounts();
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const lastTapRef = useRef<number>(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const profileHref = profile ? `/profile/${profile.username}` : '/auth';

  const navItems = [
    { icon: Home, href: '/', label: 'Home', badge: 0, isProfile: false },
    { icon: PlusCircle, href: '/create', label: 'Create', badge: 0, isProfile: false },
    { icon: Clapperboard, href: '/reels', label: 'Reels', badge: 0, isProfile: false },
    { icon: MessagesSquare, href: '/messages', label: 'Messages', badge: unreadMessages, isProfile: false },
    { icon: null, href: profileHref, label: 'Profile', badge: 0, isProfile: true },
  ];

  const handleProfileClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    const now = Date.now();
    const delta = now - lastTapRef.current;
    if (delta > 0 && delta < 350) {
      // Double tap detected
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapRef.current = 0;
      setShowAccountSwitcher(true);
      return;
    }
    lastTapRef.current = now;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      navigate(href);
    }, 260);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t md:hidden">
      <div className="flex items-center justify-evenly h-14 px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.label}
              to={item.href}
              aria-label={item.isProfile ? `${item.label} (double-tap to switch account)` : item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={item.isProfile ? (e) => handleProfileClick(e, item.href) : undefined}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 relative",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.isProfile ? (
                <Avatar className={cn("w-7 h-7 transition-all duration-200", isActive && "ring-2 ring-primary")}>
                  <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.username ? `${profile.username} profile` : 'Your profile'} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <item.icon 
                  aria-hidden="true"
                  className={cn(
                    "w-6 h-6 transition-all duration-200",
                    isActive && "scale-110"
                  )}
                  fill={isActive ? "currentColor" : "none"}
                />
              )}
              {item.badge > 0 && (
                <span aria-label={`${item.badge} unread`} className="absolute top-1 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <AccountSwitcher open={showAccountSwitcher} onOpenChange={setShowAccountSwitcher} />
    </nav>
  );
}