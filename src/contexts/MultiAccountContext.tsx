import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
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
  /**
   * Force a save of the currently-signed-in user into the stored accounts
   * list. Call this right after a successful sign-in / sign-up so we don't
   * rely solely on the auth event listener, which can miss saves on the
   * second step of the Switch Account flow.
   */
  saveCurrentSession: () => Promise<void>;
}

const STORAGE_KEY = 'openflip_accounts';

const MultiAccountContext = createContext<MultiAccountContextType | undefined>(undefined);

function readStored(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function MultiAccountProvider({ children }: { children: ReactNode }) {
  // Hydrate synchronously on first render so the AccountSwitcher can render
  // the previously-saved list immediately (avoids the sheet flashing empty).
  const [accounts, setAccounts] = useState<StoredAccount[]>(() => readStored());
  const [currentAccount, setCurrentAccount] = useState<StoredAccount | null>(() => {
    const list = readStored();
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.lastUsed - a.lastUsed)[0] ?? null;
  });

  // Keep a ref of the current accounts so we don't rebuild callbacks on
  // every state change (which would resubscribe the auth listener).
  const accountsRef = useRef(accounts);
  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  const persistAccount = useCallback((account: StoredAccount) => {
    setAccounts((prev) => {
      const existing = prev.find((a) => a.id === account.id);
      let updated: StoredAccount[];
      if (existing) {
        updated = prev.map((a) =>
          a.id === account.id ? { ...a, ...account, lastUsed: Date.now() } : a,
        );
      } else {
        updated = [...prev, { ...account, lastUsed: Date.now() }].slice(-5);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('MultiAccount: failed to persist accounts', e);
      }
      return updated;
    });
  }, []);

  /**
   * Read the current auth session and save it into the stored-accounts list.
   * Fetches the user's profile for username/avatar; if that fails (e.g. right
   * after signup before the trigger row is visible), falls back to session
   * user metadata so we ALWAYS save something for the freshly-authenticated
   * user.
   */
  const saveCurrentSession = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user) return;

      const userId = session.user.id;
      const email = session.user.email || '';
      const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;

      let username = (meta.username as string) || email.split('@')[0] || 'user';
      let avatarUrl: string | null = (meta.avatar_url as string) || null;
      let fullName: string | null = (meta.full_name as string) || (meta.name as string) || null;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url, full_name')
          .eq('id', userId)
          .maybeSingle();
        if (profile) {
          username = profile.username || username;
          avatarUrl = profile.avatar_url ?? avatarUrl;
          fullName = profile.full_name ?? fullName;
        }
      } catch (e) {
        console.warn('MultiAccount: profile fetch failed, using session metadata', e);
      }

      const account: StoredAccount = {
        id: userId,
        email,
        username,
        avatar_url: avatarUrl,
        full_name: fullName,
        lastUsed: Date.now(),
      };

      persistAccount(account);
      setCurrentAccount(account);
    } catch (e) {
      console.error('MultiAccount: saveCurrentSession failed', e);
    }
  }, [persistAccount]);

  useEffect(() => {
    // Initial sync — captures a session that was already restored from
    // storage before this provider mounted.
    saveCurrentSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // CRITICAL: never make async Supabase calls directly inside this
      // callback — it can deadlock. Defer via setTimeout(..., 0). This was
      // the root cause of new accounts not being saved on the second step
      // (the /auth page) of the Switch Account flow.
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(() => {
          saveCurrentSession();
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setCurrentAccount(null);
      } else if (event === 'USER_UPDATED' && session?.user) {
        setTimeout(() => {
          saveCurrentSession();
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [saveCurrentSession]);

  const removeAccount = useCallback((accountId: string) => {
    setAccounts((prev) => {
      const updated = prev.filter((a) => a.id !== accountId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setCurrentAccount((cur) => (cur?.id === accountId ? null : cur));
  }, []);

  const switchAccount = useCallback(async (accountId: string): Promise<boolean> => {
    const account = accountsRef.current.find((a) => a.id === accountId);
    if (!account) return false;
    // Bump lastUsed so the target account is highlighted on the auth page.
    persistAccount({ ...account, lastUsed: Date.now() });
    await supabase.auth.signOut();
    return true;
  }, [persistAccount]);

  const updateCurrentAccount = useCallback((profile: Profile) => {
    setCurrentAccount((cur) => {
      if (!cur) return cur;
      const updated: StoredAccount = {
        ...cur,
        username: profile.username || cur.username,
        avatar_url: profile.avatar_url ?? cur.avatar_url,
        full_name: profile.full_name ?? cur.full_name,
        lastUsed: Date.now(),
      };
      persistAccount(updated);
      return updated;
    });
  }, [persistAccount]);

  return (
    <MultiAccountContext.Provider
      value={{
        accounts,
        currentAccount,
        addAccount: persistAccount,
        removeAccount,
        switchAccount,
        updateCurrentAccount,
        saveCurrentSession,
      }}
    >
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
