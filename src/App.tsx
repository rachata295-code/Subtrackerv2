import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppToaster } from './components/ui/Toaster';
import { Skeleton } from './components/ui/Skeleton';
import PreviewHome from './pages/preview/PreviewHome';

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

// HashRouter so the app works at any hosting sub-path (GitHub Pages) without server rewrites.
export default function App() {
  return (
    // future flags opt in to v7 behaviour now, which also silences the v6 console warnings.
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route
          path="/design"
          element={
            <Suspense fallback={<DesignFallback />}>
              <DesignPage />
            </Suspense>
          }
        />
        <Route path="/preview-home" element={<PreviewHome />} />
        <Route path="*" element={<Navigate to="/design" replace />} />
      </Routes>
      {/* Mounted once at the root (inside ThemeProvider, which main.tsx supplies) so notify() works from any page. */}
      <AppToaster />
    </HashRouter>
  );
}
