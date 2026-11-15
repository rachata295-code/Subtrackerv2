import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isFixturesMode, isSupabaseConfigured, supabase } from '../lib/supabase';
import type { AuthClient, AuthContextValue, AuthSession, AuthStatus, AuthUser, SeedDefaultsFn } from './types';

const FIXTURE_USER: AuthUser = {
  id: 'fixture-user',
  email: 'fixture@subtracker.local',
};

const FIXTURE_SESSION: AuthSession = {
  access_token: 'fixture-token',
  user: FIXTURE_USER,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  /** Optional auth client override for tests; defaults to `supabase.auth` from `src/lib/supabase.ts`. */
  client?: AuthClient;
  /** Optional callback invoked once after the user's first sign-in to seed default rows. */
  seedDefaults?: SeedDefaultsFn;
}

export function AuthProvider({ children, client, seedDefaults }: AuthProviderProps) {
  const fixtures = isFixturesMode();
  // Avoid reading supabase.auth through the lazy Proxy when Supabase env vars are unconfigured.
  const authClient = client ?? (!fixtures && isSupabaseConfigured() ? (supabase.auth as unknown as AuthClient) : undefined);
  const seedCallback = seedDefaults;

  const [session, setSession] = useState<AuthSession | null>(() => (fixtures ? FIXTURE_SESSION : null));
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (fixtures) return 'signedIn';
    return authClient ? 'loading' : 'signedOut';
  });

  // Tracks the user already seeded in this login cycle so signIn + SIGNED_IN event never double-seed.
  const seededUserIdRef = useRef<string | null>(null);
  const seedCallbackRef = useRef(seedCallback);
  seedCallbackRef.current = seedCallback;

  const triggerSeedDefaults = useCallback(async (user: AuthUser | null | undefined) => {
    const fn = seedCallbackRef.current;
    if (!fn || !user) return;
    if (seededUserIdRef.current === user.id) return;
    seededUserIdRef.current = user.id;
    try {
      await fn(user);
    } catch {
      // Seeding defaults is best-effort and must not block signing in.
    }
  }, []);

  useEffect(() => {
    if (fixtures) {
      setSession(FIXTURE_SESSION);
      setStatus('signedIn');
      return;
    }

    if (!authClient) {
      setSession(null);
      setStatus('signedOut');
      return;
    }

    let mounted = true;
    // Prevents an in-flight getSession() response from overwriting a newer auth event.
    let eventReceived = false;

    setStatus('loading');

    const {
      data: { subscription },
    } = authClient.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      eventReceived = true;
      setSession(nextSession);
      setStatus(nextSession ? 'signedIn' : 'signedOut');
      if (event === 'SIGNED_IN' && nextSession?.user) {
        void triggerSeedDefaults(nextSession.user);
      } else if (event === 'SIGNED_OUT') {
        seededUserIdRef.current = null;
      }
    });

    authClient
      .getSession()
      .then(({ data }) => {
        if (!mounted || eventReceived) return;
        const nextSession = data.session;
        setSession(nextSession);
        setStatus(nextSession ? 'signedIn' : 'signedOut');
      })
      .catch(() => {
        if (!mounted || eventReceived) return;
        setSession(null);
        setStatus('signedOut');
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fixtures, authClient, triggerSeedDefaults]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (fixtures) {
        setSession(FIXTURE_SESSION);
        setStatus('signedIn');
        return;
      }
      if (!authClient) {
        throw new Error('Auth client is not configured');
      }
      const { data, error } = await authClient.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      const nextSession =
        data.session ?? (data.user ? { user: data.user } : null);
      if (nextSession) {
        setSession(nextSession);
        setStatus('signedIn');
        await triggerSeedDefaults(nextSession.user);
      }
    },
    [fixtures, authClient, triggerSeedDefaults],
  );

  const signOut = useCallback(async () => {
    if (fixtures) {
      // Fixtures mode always stays signedIn so offline/preview development never locks behind /login.
      setSession(FIXTURE_SESSION);
      setStatus('signedIn');
      return;
    }
    seededUserIdRef.current = null;
    if (authClient) {
      const { error } = await authClient.signOut();
      if (error) throw error;
    }
    setSession(null);
    setStatus('signedOut');
  }, [fixtures, authClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      status,
      signIn,
      signOut,
    }),
    [session, status, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
