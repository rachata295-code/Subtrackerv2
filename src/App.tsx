import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './auth';
import { AppShell } from './components/layout/AppShell';
import { AppToaster } from './components/ui/Toaster';
import { Skeleton } from './components/ui/Skeleton';
import BillsPage from './pages/bills';
import EntriesPage from './pages/entries';
import LoginPage from './pages/login';
import OverviewPage from './pages/overview';
import PreviewHome from './pages/preview/PreviewHome';
import SettingsPage from './pages/settings';

// The showcase pulls in tokens.css?raw (to compute contrast ratios) and every component demo; it is a dev tool,
// so it loads on demand and stays out of the main bundle.
const DesignPage = lazy(() => import('./pages/DesignPage'));

// Only shown for the instant the chunk loads (or never, once the service worker has cached it).
function DesignFallback() {
  return (
    <div className="mx-auto w-full max-w-[480px] space-y-3 px-screen pt-5" role="status" aria-label="กำลังโหลด">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

// Exported separately from HashRouter so route tests can mount it inside MemoryRouter.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/bills" element={<BillsPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
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

// HashRouter so the app works at any hosting sub-path (GitHub Pages) without server rewrites.
export default function App() {
  return (
    <AuthProvider>
      {/* future flags opt in to v7 behaviour now, which also silences the v6 console warnings. */}
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
        {/* Mounted once at the root (inside ThemeProvider, which main.tsx supplies) so notify() works from any page. */}
        <AppToaster />
      </HashRouter>
    </AuthProvider>
  );
}
