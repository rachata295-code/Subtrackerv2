import { lazy, Suspense, useCallback, useContext, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientContext, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, RequireAuth, useAuth } from './auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { AppToaster } from './components/ui/Toaster';
import { Skeleton } from './components/ui/Skeleton';
import { seedDefaults } from './data/financeRepo';
import { FINANCE_QUERY_KEY } from './hooks/useFinance';
import { isSupabaseConfigured } from './lib/supabase';
import BillsPage from './pages/bills';
import EntriesPage from './pages/entries';
import LoginPage from './pages/login';
import OverviewPage from './pages/overview';
import PlanPage from './pages/plan';
import PreviewHome from './pages/preview/PreviewHome';
import SettingsPage from './pages/settings';

// The showcase pulls in tokens.css?raw (to compute contrast ratios) and every component demo; it is a dev tool,
// so it loads on demand and stays out of the main bundle.
const DesignPage = lazy(() => import('./pages/DesignPage'));

// Only shown for the instant the chunk loads (or never, once the service worker has cached it).
function DesignFallback() {
  return (
    <div className="mx-auto w-full max-w-phone space-y-3 px-screen pt-5" role="status" aria-label="กำลังโหลด">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function SettingsRoute() {
  const { signOut } = useAuth();
  return <SettingsPage onSignOut={signOut} />;
}

// Exported separately from HashRouter so route tests can mount it inside MemoryRouter.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/plan" element={<PlanPage />} />
          <Route path="/bills" element={<BillsPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/settings" element={<SettingsRoute />} />
        </Route>
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/design"
        element={
          <Suspense fallback={<DesignFallback />}>
            <DesignPage />
          </Suspense>
        }
      />
      <Route path="/preview-home" element={<PreviewHome />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppRoot({ queryClient }: { queryClient: QueryClient }) {
  const handleSeedDefaults = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    await seedDefaults();
    await queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
  }, [queryClient]);

  return (
    <AuthProvider seedDefaults={handleSeedDefaults}>
      {/* future flags opt in to v7 behaviour now, which also silences the v6 console warnings. */}
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
        {/* Mounted once at the root so notify() works from any page. */}
        <AppToaster />
      </HashRouter>
    </AuthProvider>
  );
}

// HashRouter so the app works at any hosting sub-path (GitHub Pages) without server rewrites.
export default function App() {
  const existingClient = useContext(QueryClientContext);
  const [fallbackClient] = useState(() => new QueryClient());
  const activeClient = existingClient ?? fallbackClient;

  return (
    <ErrorBoundary>
      {existingClient ? (
        <AppRoot queryClient={activeClient} />
      ) : (
        <QueryClientProvider client={activeClient}>
          <AppRoot queryClient={activeClient} />
        </QueryClientProvider>
      )}
    </ErrorBoundary>
  );
}
