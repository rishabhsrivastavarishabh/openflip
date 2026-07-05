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
  /**
   * Switch to a saved account. Returns:
   *  - 'switched' — session restored via cached refresh token, user is already signed in.
   *  - 'needs_auth' — no valid cached session; caller should route to /auth.
   *  - 'failed'    — unexpected error.
   */
  switchAccount: (accountId: string) => Promise<'switched' | 'needs_auth' | 'failed'>;
  updateCurrentAccount: (profile: Profile) => void;
  saveCurrentSession: () => Promise<void>;
}

const STORAGE_KEY = 'openflip_accounts';
const SESSION_STORE_KEY = 'openflip_account_sessions';

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

type SessionMap = Record<string, { access_token: string; refresh_token: string }>;

function readSessions(): SessionMap {
  try {
    const raw = localStorage.getItem(SESSION_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSessions(map: SessionMap) {
  try {
    localStorage.setItem(SESSION_STORE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function MultiAccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<StoredAccount[]>(() => readStored());
  const [currentAccount, setCurrentAccount] = useState<StoredAccount | null>(() => {
    const list = readStored();
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.lastUsed - a.lastUsed)[0] ?? null;
  });

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

      // Also cache the tokens so we can restore this session later without
      // asking for the password. Refresh tokens rotate on every use, so we
      // grab the freshest pair now.
      if (session.access_token && session.refresh_token) {
        const sessions = readSessions();
        sessions[userId] = {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        };
        writeSessions(sessions);
      }
    } catch (e) {
      console.error('MultiAccount: saveCurrentSession failed', e);
    }
  }, [persistAccount]);

  useEffect(() => {
    saveCurrentSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(() => saveCurrentSession(), 0);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Keep the cached refresh token fresh so silent switching keeps working.
        setTimeout(() => saveCurrentSession(), 0);
      } else if (event === 'SIGNED_OUT') {
        setCurrentAccount(null);
      } else if (event === 'USER_UPDATED' && session?.user) {
        setTimeout(() => saveCurrentSession(), 0);
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
    // Drop the cached session too.
    const sessions = readSessions();
    if (sessions[accountId]) {
      delete sessions[accountId];
      writeSessions(sessions);
    }
    setCurrentAccount((cur) => (cur?.id === accountId ? null : cur));
  }, []);

  const switchAccount = useCallback(async (accountId: string): Promise<'switched' | 'needs_auth' | 'failed'> => {
    const account = accountsRef.current.find((a) => a.id === accountId);
    if (!account) return 'failed';

    persistAccount({ ...account, lastUsed: Date.now() });

    const sessions = readSessions();
    const cached = sessions[accountId];

    // Try silent switch via cached refresh token first.
    if (cached?.refresh_token) {
      try {
        // Sign out the current account first so setSession replaces cleanly.
        await supabase.auth.signOut();
        const { data, error } = await supabase.auth.setSession({
          access_token: cached.access_token,
          refresh_token: cached.refresh_token,
        });
        if (!error && data.session?.user?.id === accountId) {
          return 'switched';
        }
        // Refresh token invalid/expired — drop it so we don't keep trying.
        delete sessions[accountId];
        writeSessions(sessions);
      } catch (e) {
        console.warn('MultiAccount: silent switch failed', e);
      }
    } else {
      await supabase.auth.signOut();
    }

    return 'needs_auth';
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
