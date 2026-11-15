import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './App';

vi.mock('./components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'system', resolved: 'light', setPref: vi.fn() }),
}));

afterEach(cleanup);

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe('App routes', () => {
  it.each([
    ['/', 'ภาพรวม'],
    ['/bills', 'บิล & ผ่อน'],
    ['/entries', 'รายการ'],
    ['/settings', 'ตั้งค่า'],
    ['/login', 'เข้าสู่ระบบ'],
    ['/preview-home', 'ภาพรวม'],
  ])('renders heading for %s', (path, heading) => {
    renderRoute(path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it('keeps /design route working', async () => {
    renderRoute('/design');
    expect(await screen.findByRole('heading', { level: 1, name: 'Design system' })).toBeTruthy();
  });
});
