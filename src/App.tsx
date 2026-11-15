import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppToaster } from './components/ui/Toaster';
import DesignPage from './pages/DesignPage';
import PreviewHome from './pages/preview/PreviewHome';

// HashRouter so the app works at any hosting sub-path (GitHub Pages) without server rewrites.
export default function App() {
  return (
    // future flags opt in to v7 behaviour now, which also silences the v6 console warnings.
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/design" element={<DesignPage />} />
        <Route path="/preview-home" element={<PreviewHome />} />
        <Route path="*" element={<Navigate to="/design" replace />} />
      </Routes>
      {/* Mounted once at the root (inside ThemeProvider, which main.tsx supplies) so notify() works from any page. */}
      <AppToaster />
    </HashRouter>
  );
}
