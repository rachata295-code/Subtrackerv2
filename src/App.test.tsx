import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, type AuthClient, type AuthSession } from './auth';
import { AppRoutes } from './App';

vi.mock('./components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'system', resolved: 'light', setPref: vi.fn() }),
}));

afterEach(cleanup);

function makeTestAuthClient(session: AuthSession | null): AuthClient {
  return {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { user: session?.user ?? null, session }, error: null }),
    signOut: async () => ({ error: null }),
  };
}

function renderRoute(path: string) {
  const session: AuthSession | null = path === '/login' ? null : { user: { id: 'test-user', email: 'test@example.com' } };
  return render(
    <AuthProvider client={makeTestAuthClient(session)}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
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
  ])('renders heading for %s', async (path, heading) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it('keeps /design route working', async () => {
    renderRoute('/design');
    expect(await screen.findByRole('heading', { level: 1, name: 'Design system' })).toBeTruthy();
  });
});
