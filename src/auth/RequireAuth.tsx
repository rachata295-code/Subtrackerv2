import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from './AuthProvider';

export interface RequireAuthProps {
  children?: ReactNode;
}

/** Guards private routes: shows a skeleton while checking session, redirects signed-out users to /login with return state. */
export function RequireAuth({ children }: RequireAuthProps) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div
        className="mx-auto flex h-dvh w-full max-w-[480px] flex-col space-y-3 bg-ground px-screen pt-5"
        role="status"
        aria-label="กำลังโหลด"
      >
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children ?? <Outlet />}</>;
}
