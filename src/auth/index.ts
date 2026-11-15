export { AuthProvider, useAuth, useOptionalAuth, type AuthProviderProps } from './AuthProvider';
export { RequireAuth, type RequireAuthProps } from './RequireAuth';
export { translateAuthError } from './errors';
export type {
  AuthChangeEvent,
  AuthClient,
  AuthContextValue,
  AuthErrorLike,
  AuthSession,
  AuthStatus,
  AuthUser,
  SeedDefaultsFn,
} from './types';
