import { Home, Search, PlusSquare, Heart, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function MobileNav() {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { icon: Home, href: '/', label: 'Home' },
    { icon: Search, href: '/explore', label: 'Explore' },
    { icon: PlusSquare, href: '/create', label: 'Create' },
    { icon: Heart, href: '/notifications', label: 'Notifications' },
    { icon: User, href: user ? `/profile/${user.id}` : '/auth', label: 'Profile' },
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
                "flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200",
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
