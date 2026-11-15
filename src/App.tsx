import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

// Placeholders: Task 10 replaces DesignPage and Task 11 replaces PreviewHomePage.
function DesignPage() {
  return <main className="p-screen">หน้า Design System</main>;
}

function PreviewHomePage() {
  return <main className="p-screen">หน้าภาพรวมตัวอย่าง</main>;
}

// HashRouter so the app works at any hosting sub-path (GitHub Pages) without server rewrites.
export default function App() {
  return (
    // future flags opt in to v7 behaviour now, which also silences the v6 console warnings.
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/design" element={<DesignPage />} />
        <Route path="/preview-home" element={<PreviewHomePage />} />
        <Route path="*" element={<Navigate to="/design" replace />} />
      </Routes>
    </HashRouter>
  );
}
