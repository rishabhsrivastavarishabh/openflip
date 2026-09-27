import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, X, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useMultiAccount } from '@/contexts/MultiAccountContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AccountSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountSwitcher({ open, onOpenChange }: AccountSwitcherProps) {
  const navigate = useNavigate();
  const { accounts, currentAccount, switchAccount, removeAccount, saveCurrentSession } = useMultiAccount();
  const { user, profile, signOut } = useAuth();
  const [switching, setSwitching] = useState(false);

  const handleSwitchAccount = async (accountId: string) => {
    if (accountId === user?.id) {
      onOpenChange(false);
      return;
    }

    const target = accounts.find(a => a.id === accountId);
    setSwitching(true);
    // Persist CURRENT account (with fresh tokens) before switching so we can
    // silently switch back later.
    await saveCurrentSession();
    const result = await switchAccount(accountId);

    if (result === 'switched') {
      toast.success(target ? `Switched to @${target.username}` : 'Account switched');
      onOpenChange(false);
      navigate('/');
    } else if (result === 'needs_auth') {
      toast.info(target ? `Sign in to continue as @${target.username}` : 'Sign in to continue');
      onOpenChange(false);
      navigate('/auth');
    } else {
      toast.error('Failed to switch account');
    }
    setSwitching(false);
  };

  const handleAddAccount = async () => {
    // Persist the currently-signed-in account BEFORE signing out so it stays
    // in the switcher after the user finishes signing in as the new account.
    await saveCurrentSession();
    await signOut();
    onOpenChange(false);
    navigate('/auth');
  };

  const handleRemoveAccount = (accountId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (accountId === user?.id) {
      toast.error("Can't remove currently active account");
      return;
    }
    
    removeAccount(accountId);
    toast.success('Account removed');
  };

  const otherAccounts = accounts.filter(a => a.id !== user?.id);
  const active = user
    ? {
        username: currentAccount?.id === user.id ? currentAccount.username : profile?.username || user.email?.split('@')[0] || 'you',
        email: user.email || '',
        avatar_url: (currentAccount?.id === user.id ? currentAccount.avatar_url : profile?.avatar_url) || null,
      }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Accounts</SheetTitle>
          <SheetDescription>
            Switch between saved accounts or sign in to another one.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* Signed in */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Signed in as</p>
            {active ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30">
                <Avatar className="h-12 w-12 ring-2 ring-primary">
                  <AvatarImage src={active.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {active.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{active.username}</p>
                  <p className="text-sm text-muted-foreground truncate">{active.email}</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  <Check className="h-4 w-4" /> Active
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">You're not signed in.</p>
              </div>
            )}
          </div>

          {/* Saved accounts */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Saved accounts {otherAccounts.length > 0 && `(${otherAccounts.length})`}
            </p>
            {otherAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">No other saved accounts on this device.</p>
            ) : (
              <div className="space-y-1">
                {otherAccounts.map(account => (
                  <div
                    key={account.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => !switching && handleSwitchAccount(account.id)}
                    onKeyDown={(e) => e.key === 'Enter' && !switching && handleSwitchAccount(account.id)}
                    aria-label={`Switch to ${account.username}`}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors cursor-pointer ${switching ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={account.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {account.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-semibold truncate">{account.username}</p>
                      <p className="text-sm text-muted-foreground truncate">{account.email}</p>
                    </div>
                    <span className="text-xs text-primary font-medium">Switch</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${account.username}`}
                      onClick={(e) => handleRemoveAccount(account.id, e)}
                      className="opacity-50 hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sign in / Add */}
          <Button
            variant="gradient"
            className="w-full"
            onClick={user ? handleAddAccount : () => { onOpenChange(false); navigate('/auth'); }}
            disabled={switching}
          >
            <Plus className="h-4 w-4 mr-1" />
            {user ? 'Add account' : 'Sign in'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
