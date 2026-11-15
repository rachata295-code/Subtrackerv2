import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, type AuthClient, type AuthSession } from './auth';
import * as ThemeProviderModule from './components/ThemeProvider';
import * as financeRepo from './data/financeRepo';
import { financeFixture } from './fixtures/finance';
import App, { AppRoutes } from './App';

vi.mock('./components/ThemeProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof ThemeProviderModule>();
  return {
    ...actual,
    useTheme: vi.fn(() => ({ pref: 'system' as const, resolved: 'light' as const, setPref: vi.fn() })),
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

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

  it('wires SettingsPage onSignOut to AuthProvider.signOut and redirects to /login', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.spyOn(financeRepo, 'loadFinanceData').mockResolvedValue(financeFixture);

    const session: AuthSession = { user: { id: 'test-user', email: 'test@example.com' } };
    const signOut = vi.fn(async () => ({ error: null }));
    const client: AuthClient = {
      getSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: { user: session.user, session }, error: null }),
      signOut,
    };

    render(
      <AuthProvider client={client}>
        <MemoryRouter initialEntries={['/settings']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    );

    const signOutBtn = await screen.findByRole('button', { name: 'ออกจากระบบ' });
    fireEvent.click(signOutBtn);
    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeTruthy();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('renders App root without crashing when Supabase env vars are not configured', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeTruthy();
  });

  it('catches render errors inside app-level ErrorBoundary', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(ThemeProviderModule.useTheme).mockImplementation(() => {
      throw new Error('boom');
    });

    try {
      render(<App />);
      expect(screen.getByText('เกิดข้อผิดพลาดที่ไม่คาดคิด')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'โหลดใหม่' })).toBeTruthy();
    } finally {
      vi.mocked(ThemeProviderModule.useTheme).mockImplementation(() => ({
        pref: 'system',
        resolved: 'light',
        setPref: vi.fn(),
      }));
    }
  });
});
