import { Home, Search, PlusSquare, MessageCircle, User, Film } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';

export function MobileNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { unreadMessages } = useUnreadCounts();

  const navItems = [
    { icon: Home, href: '/', label: 'Home', badge: 0 },
    { icon: Search, href: '/explore', label: 'Explore', badge: 0 },
    { icon: PlusSquare, href: '/create', label: 'Create', badge: 0 },
    { icon: Film, href: '/reels', label: 'Reels', badge: 0 },
    { icon: MessageCircle, href: '/messages', label: 'Messages', badge: unreadMessages },
    { icon: User, href: user ? `/profile/${user.id}` : '/auth', label: 'Profile', badge: 0 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t md:hidden">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200 relative",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon 
                className={cn(
                  "w-6 h-6 transition-all duration-200",
                  isActive && "scale-110"
                )}
                fill={isActive ? "currentColor" : "none"}
              />
              {item.badge > 0 && (
                <span className="absolute top-1 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
