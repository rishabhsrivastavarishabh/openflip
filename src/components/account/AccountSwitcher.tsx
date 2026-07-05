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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Switch Account</SheetTitle>
          <SheetDescription>
            Choose an account or add a new one
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-2">
          {/* Current Account */}
          {currentAccount && user && (
            <div
              className="flex items-center gap-3 p-3 rounded-xl bg-secondary"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={currentAccount.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {currentAccount.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{currentAccount.username}</p>
                <p className="text-sm text-muted-foreground truncate">{currentAccount.email}</p>
              </div>
              <Check className="h-5 w-5 text-primary" />
            </div>
          )}

          {/* Other Accounts */}
          {otherAccounts.map(account => (
            <button
              key={account.id}
              onClick={() => handleSwitchAccount(account.id)}
              disabled={switching}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors disabled:opacity-50"
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
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => handleRemoveAccount(account.id, e)}
                className="opacity-50 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </button>
          ))}

          {/* Add Account */}
          <button
            onClick={handleAddAccount}
            disabled={switching}
            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors text-primary"
          >
            <div className="h-12 w-12 rounded-full border-2 border-dashed border-primary flex items-center justify-center">
              <Plus className="h-5 w-5" />
            </div>
            <span className="font-medium">Add Account</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
