import { useState } from 'react';
import { Home, Search, PlusSquare, Heart, MessageCircle, User, Menu, LogOut, Settings, Users, Film } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useMultiAccount } from '@/contexts/MultiAccountContext';
import { useUnreadCounts } from '@/hooks/useUnreadCounts';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AccountSwitcher } from '@/components/account/AccountSwitcher';
import openflipLogo from '@/assets/openflip-logo.png';

export function Sidebar() {
  const location = useLocation();
  const { user, profile, signOut } = useAuth();
  const { accounts } = useMultiAccount();
  const { unreadMessages, unreadNotifications } = useUnreadCounts();
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  const hasMultipleAccounts = accounts.length > 1;

  const navItems = [
    { icon: Home, href: '/', label: 'Home', badge: 0 },
    { icon: Search, href: '/explore', label: 'Explore', badge: 0 },
    { icon: Film, href: '/reels', label: 'Reels', badge: 0 },
    { icon: MessageCircle, href: '/messages', label: 'Messages', badge: unreadMessages },
    { icon: Heart, href: '/notifications', label: 'Notifications', badge: unreadNotifications },
    { icon: User, href: user ? `/profile/${user.id}` : '/auth', label: 'Profile', badge: 0 },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[72px] lg:w-[244px] flex-col border-r border-border bg-background z-50">
      {/* Logo */}
      <div className="flex items-center h-20 px-4 lg:px-6">
        <Link to="/" className="flex items-center">
          <img src={openflipLogo} alt="Openflip" className="h-8 lg:h-10" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 lg:px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/' && location.pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group relative",
                    isActive
                      ? "bg-secondary text-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <div className="relative">
                    <item.icon
                      className={cn(
                        "w-6 h-6 transition-transform duration-200 group-hover:scale-110",
                        isActive && "scale-110"
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-bold rounded-full">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="hidden lg:block">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="hidden lg:flex ml-auto min-w-[20px] h-5 px-1.5 items-center justify-center bg-destructive text-destructive-foreground text-xs font-bold rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Menu */}
      <div className="p-3 border-t border-border">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 py-6 hover:bg-secondary"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {profile?.username || 'User'}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {profile?.full_name}
                  </span>
                </div>
                <Menu className="hidden lg:block ml-auto h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {hasMultipleAccounts && (
                <>
                  <DropdownMenuItem onClick={() => setShowAccountSwitcher(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Switch Account
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => setShowAccountSwitcher(true)}>
                <User className="h-4 w-4 mr-2" />
                Add Account
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="gradient" className="w-full">
            <Link to="/auth">Sign in</Link>
          </Button>
        )}

        {/* Account Switcher Modal */}
        <AccountSwitcher 
          open={showAccountSwitcher} 
          onOpenChange={setShowAccountSwitcher} 
        />
      </div>
    </aside>
  );
}
