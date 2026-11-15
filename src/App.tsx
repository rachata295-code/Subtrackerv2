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
    <HashRouter>
      <Routes>
        <Route path="/design" element={<DesignPage />} />
        <Route path="/preview-home" element={<PreviewHomePage />} />
        <Route path="*" element={<Navigate to="/design" replace />} />
      </Routes>
    </HashRouter>
  );
}
