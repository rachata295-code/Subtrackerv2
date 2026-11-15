/** Minimal user shape matching Supabase Auth's User object. */
export interface AuthUser {
  id: string;
  email?: string | null;
}

/** Minimal session shape matching Supabase Auth's Session object. */
export interface AuthSession {
  access_token?: string;
  user: AuthUser;
}

/** Error shape returned by Supabase Auth methods or thrown by fetch. */
export interface AuthErrorLike {
  message: string;
  status?: number;
  code?: string;
  name?: string;
}

export type AuthChangeEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'
  | (string & {});

/**
 * Adapter interface matching `supabase.auth` so `AuthProvider` can use the real
 * Supabase client when `src/lib/supabase.ts` exists and a fake client in tests.
 */
export interface AuthClient {
  getSession(): Promise<{ data: { session: AuthSession | null }; error: AuthErrorLike | null }>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: AuthSession | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } };
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: { user: AuthUser | null; session: AuthSession | null }; error: AuthErrorLike | null }>;
  signOut(): Promise<{ error: AuthErrorLike | null }>;
}

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

export type SeedDefaultsFn = (user: AuthUser) => Promise<void> | void;

export interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
