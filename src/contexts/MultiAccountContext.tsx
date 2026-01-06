import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';

interface StoredAccount {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
  lastUsed: number;
}

interface MultiAccountContextType {
  accounts: StoredAccount[];
  currentAccount: StoredAccount | null;
  addAccount: (account: StoredAccount) => void;
  removeAccount: (accountId: string) => void;
  switchAccount: (accountId: string) => Promise<boolean>;
  updateCurrentAccount: (profile: Profile) => void;
}

const STORAGE_KEY = 'openflip_accounts';

const MultiAccountContext = createContext<MultiAccountContextType | undefined>(undefined);

export function MultiAccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [currentAccount, setCurrentAccount] = useState<StoredAccount | null>(null);

  // Load accounts from localStorage on mount
  useEffect(() => {
    const storedAccounts = localStorage.getItem(STORAGE_KEY);
    if (storedAccounts) {
      try {
        const parsed = JSON.parse(storedAccounts) as StoredAccount[];
        setAccounts(parsed);
        // Set most recently used as current
        const sorted = [...parsed].sort((a, b) => b.lastUsed - a.lastUsed);
        if (sorted.length > 0) {
          setCurrentAccount(sorted[0]);
        }
      } catch (e) {
        console.error('Failed to parse stored accounts:', e);
      }
    }
  }, []);

  // Sync current session with stored accounts
  useEffect(() => {
    const syncCurrentSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          const account: StoredAccount = {
            id: session.user.id,
            email: session.user.email || '',
            username: profile.username,
            avatar_url: profile.avatar_url,
            full_name: profile.full_name,
            lastUsed: Date.now(),
          };
          
          addAccount(account);
          setCurrentAccount(account);
        }
      }
    };

    syncCurrentSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Fetch profile and add to accounts
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile) {
              const account: StoredAccount = {
                id: session.user.id,
                email: session.user.email || '',
                username: profile.username,
                avatar_url: profile.avatar_url,
                full_name: profile.full_name,
                lastUsed: Date.now(),
              };
              addAccount(account);
              setCurrentAccount(account);
            }
          });
      } else if (event === 'SIGNED_OUT') {
        setCurrentAccount(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const saveAccounts = (newAccounts: StoredAccount[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newAccounts));
    setAccounts(newAccounts);
  };

  const addAccount = (account: StoredAccount) => {
    setAccounts(prev => {
      const existing = prev.find(a => a.id === account.id);
      let updated: StoredAccount[];
      
      if (existing) {
        // Update existing account
        updated = prev.map(a => 
          a.id === account.id 
            ? { ...account, lastUsed: Date.now() } 
            : a
        );
      } else {
        // Add new account (max 5 accounts)
        updated = [...prev, { ...account, lastUsed: Date.now() }].slice(-5);
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const removeAccount = (accountId: string) => {
    setAccounts(prev => {
      const updated = prev.filter(a => a.id !== accountId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    
    if (currentAccount?.id === accountId) {
      setCurrentAccount(null);
    }
  };

  const switchAccount = async (accountId: string): Promise<boolean> => {
    // This triggers the sign-out which will be handled by the auth flow
    // The user will need to re-authenticate with credentials
    // For security, we don't store tokens/passwords
    
    const account = accounts.find(a => a.id === accountId);
    if (account) {
      // Update last used
      addAccount({ ...account, lastUsed: Date.now() });
      
      // Sign out current session - user will need to log in with the other account
      await supabase.auth.signOut();
      
      // Return the account email for pre-filling
      return true;
    }
    return false;
  };

  const updateCurrentAccount = (profile: Profile) => {
    if (currentAccount) {
      const updated: StoredAccount = {
        ...currentAccount,
        username: profile.username,
        avatar_url: profile.avatar_url,
        full_name: profile.full_name,
        lastUsed: Date.now(),
      };
      addAccount(updated);
      setCurrentAccount(updated);
    }
  };

  return (
    <MultiAccountContext.Provider value={{
      accounts,
      currentAccount,
      addAccount,
      removeAccount,
      switchAccount,
      updateCurrentAccount,
    }}>
      {children}
    </MultiAccountContext.Provider>
  );
}

export function useMultiAccount() {
  const context = useContext(MultiAccountContext);
  if (context === undefined) {
    throw new Error('useMultiAccount must be used within a MultiAccountProvider');
  }
  return context;
}
