import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';
import { AuthProvider, useAuth } from './AuthProvider';
import { translateAuthError } from './errors';
import type { AuthChangeEvent, AuthClient, AuthSession, AuthUser, SeedDefaultsFn } from './types';

vi.mock('../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'system', resolved: 'light', setPref: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const TEST_USER: AuthUser = { id: 'user-1', email: 'owner@example.com' };
const TEST_SESSION: AuthSession = { access_token: 'tok-1', user: TEST_USER };

function createFakeAuthClient(initialSession: AuthSession | null = null) {
  let currentSession = initialSession;
  const listeners = new Set<(event: AuthChangeEvent, session: AuthSession | null) => void>();

  const client: AuthClient = {
    getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
    onAuthStateChange: vi.fn((cb) => {
      listeners.add(cb);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners.delete(cb);
            },
          },
        },
      };
    }),
    signInWithPassword: vi.fn(async ({ email }) => {
      const user: AuthUser = { id: TEST_USER.id, email };
      const session: AuthSession = { access_token: 'tok-1', user };
      currentSession = session;
      for (const cb of listeners) cb('SIGNED_IN', session);
      return { data: { user, session }, error: null };
    }),
    signOut: vi.fn(async () => {
      currentSession = null;
      for (const cb of listeners) cb('SIGNED_OUT', null);
      return { error: null };
    }),
  };

  return {
    client,
    emit(event: AuthChangeEvent, session: AuthSession | null) {
      currentSession = session;
      for (const cb of listeners) cb(event, session);
    },
  };
}

function renderAppAt(path: string, client: AuthClient, seedDefaults?: SeedDefaultsFn) {
  return render(
    <AuthProvider client={client} seedDefaults={seedDefaults}>
      <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe('Auth flow and route guards', () => {
  it.each(['/', '/bills', '/entries', '/settings'])(
    'redirects %s to /login when signed out',
    async (protectedPath) => {
      const { client } = createFakeAuthClient(null);
      renderAppAt(protectedPath, client);

      expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeTruthy();
      expect(screen.getByLabelText('อีเมล')).toBeTruthy();
      expect(screen.getByLabelText('รหัสผ่าน')).toBeTruthy();
    },
  );

  it('allows /preview-home and /design without logging in', async () => {
    const { client } = createFakeAuthClient(null);
    renderAppAt('/preview-home', client);
    expect(await screen.findByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();

    cleanup();
    renderAppAt('/design', client);
    expect(await screen.findByRole('heading', { level: 1, name: 'Design system' })).toBeTruthy();
  });

  it('returns to the original protected route after signing in', async () => {
    const { client } = createFakeAuthClient(null);
    renderAppAt('/bills', client);

    const emailInput = await screen.findByLabelText('อีเมล');
    const passwordInput = screen.getByLabelText('รหัสผ่าน');
    fireEvent.change(emailInput, { target: { value: 'owner@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'บิล & ผ่อน' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'เมนูหลัก' })).toBeTruthy();
    expect(client.signInWithPassword).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'secret123',
    });
  });

  it('uses mobile-friendly input attributes and provides no signup button', async () => {
    const { client } = createFakeAuthClient(null);
    renderAppAt('/login', client);

    const emailInput = await screen.findByLabelText('อีเมล');
    const passwordInput = screen.getByLabelText('รหัสผ่าน');

    expect(emailInput.getAttribute('autocomplete')).toBe('email');
    expect(emailInput.getAttribute('inputmode')).toBe('email');
    expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');
    expect(screen.queryByRole('button', { name: /สมัคร/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /สมัคร/ })).toBeNull();
  });

  it('shows a loading state on the submit button while signing in', async () => {
    const { client } = createFakeAuthClient(null);
    let resolveSignIn!: (value: {
      data: { user: AuthUser | null; session: AuthSession | null };
      error: null;
    }) => void;
    client.signInWithPassword = vi.fn(
      () =>
        new Promise<{
          data: { user: AuthUser | null; session: AuthSession | null };
          error: null;
        }>((resolve) => {
          resolveSignIn = resolve;
        }),
    );

    renderAppAt('/login', client);

    fireEvent.change(await screen.findByLabelText('อีเมล'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret123' } });
    const submitBtn = screen.getByRole('button', { name: 'เข้าสู่ระบบ' }) as HTMLButtonElement;
    fireEvent.click(submitBtn);

    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      resolveSignIn({ data: { user: TEST_USER, session: TEST_SESSION }, error: null });
    });
    expect(await screen.findByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
  });

  it('shows Thai error alert on wrong credentials and on network failure', async () => {
    const { client } = createFakeAuthClient(null);
    client.signInWithPassword = vi
      .fn()
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 },
      })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    renderAppAt('/login', client);

    fireEvent.change(await screen.findByLabelText('อีเมล'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

    const wrongCredAlert = await screen.findByRole('alert');
    expect(wrongCredAlert.textContent).toContain('อีเมลหรือรหัสผ่านไม่ถูกต้อง');

    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret123' } });
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

    const networkAlert = await screen.findByRole('alert');
    expect(networkAlert.textContent).toContain('อินเทอร์เน็ต');
  });

  it('redirects back to /login when signOut is called', async () => {
    const { client } = createFakeAuthClient(TEST_SESSION);

    function SignOutTrigger() {
      const { signOut, status } = useAuth();
      return (
        <div>
          <span data-testid="auth-status">{status}</span>
          <button type="button" onClick={() => void signOut()}>
            ออกจากระบบ
          </button>
        </div>
      );
    }

    render(
      <AuthProvider client={client}>
        <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes />
          <SignOutTrigger />
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status').textContent).toBe('signedIn');
    });

    fireEvent.click(screen.getByRole('button', { name: 'ออกจากระบบ' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeTruthy();
    expect(client.signOut).toHaveBeenCalledTimes(1);
  });

  it('calls seedDefaults once after first login via injected callback', async () => {
    const { client } = createFakeAuthClient(null);
    const seedDefaults = vi.fn(async () => {});
    renderAppAt('/', client, seedDefaults);

    fireEvent.change(await screen.findByLabelText('อีเมล'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(seedDefaults).toHaveBeenCalledTimes(1);
    expect(seedDefaults).toHaveBeenCalledWith(expect.objectContaining({ id: TEST_USER.id }));
  });

  it('stays signedIn and skips login when VITE_USE_FIXTURES=1', () => {
    vi.stubEnv('VITE_USE_FIXTURES', '1');
    const { client } = createFakeAuthClient(null);

    renderAppAt('/entries', client);

    expect(screen.getByRole('heading', { level: 1, name: 'รายการ' })).toBeTruthy();
    expect(client.getSession).not.toHaveBeenCalled();
  });

  it('validates empty email or password before calling signIn', async () => {
    const { client } = createFakeAuthClient(null);
    renderAppAt('/login', client);

    fireEvent.click(await screen.findByRole('button', { name: 'เข้าสู่ระบบ' }));

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('กรุณากรอกอีเมลและรหัสผ่าน');
    expect(client.signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows loading skeleton while session is resolving and does not redirect early', async () => {
    const { client } = createFakeAuthClient(null);
    let resolveSession!: (v: { data: { session: AuthSession | null }; error: null }) => void;
    client.getSession = vi.fn(
      () =>
        new Promise<{ data: { session: AuthSession | null }; error: null }>((resolve) => {
          resolveSession = resolve;
        }),
    );

    renderAppAt('/bills', client);

    expect(screen.getByRole('status', { name: 'กำลังโหลด' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeNull();

    await act(async () => {
      resolveSession({ data: { session: TEST_SESSION }, error: null });
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'บิล & ผ่อน' })).toBeTruthy();
  });

  it('redirects an already signed-in user away from /login to /', async () => {
    const { client } = createFakeAuthClient(TEST_SESSION);
    renderAppAt('/login', client);

    expect(await screen.findByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
  });

  it('still completes login even if seedDefaults rejects', async () => {
    const { client } = createFakeAuthClient(null);
    const failingSeed = vi.fn(async () => {
      throw new Error('seed failed');
    });
    renderAppAt('/', client, failingSeed);

    fireEvent.change(await screen.findByLabelText('อีเมล'), { target: { value: 'owner@example.com' } });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(failingSeed).toHaveBeenCalledTimes(1);
  });
});

describe('translateAuthError', () => {
  it('translates credential, network, rate-limit, and fallback errors to Thai', () => {
    expect(translateAuthError({ message: 'Invalid login credentials' })).toBe('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    expect(translateAuthError({ message: 'anything', code: 'invalid_credentials' })).toBe('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    expect(translateAuthError(new TypeError('Failed to fetch'))).toBe('เชื่อมต่ออินเทอร์เน็ตไม่ได้ กรุณาลองใหม่อีกครั้ง');
    expect(translateAuthError({ message: 'Too many requests', status: 429 })).toBe(
      'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่',
    );
    expect(translateAuthError({ message: 'Unexpected server error' })).toBe('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  });

  it('translates email_provider_disabled to Thai', () => {
    expect(translateAuthError({ message: 'Email logins are disabled', code: 'email_provider_disabled' })).toBe(
      'ยังไม่ได้เปิดการล็อกอินด้วยอีเมลใน Supabase',
    );
    expect(translateAuthError({ message: 'anything', code: 'EMAIL_PROVIDER_DISABLED', status: 401 })).toBe(
      'ยังไม่ได้เปิดการล็อกอินด้วยอีเมลใน Supabase',
    );
    expect(translateAuthError({ message: 'Email logins are disabled' })).toBe(
      'ยังไม่ได้เปิดการล็อกอินด้วยอีเมลใน Supabase',
    );
  });

  it('translates invalid_api_key and non-credential 401 responses to Supabase key error', () => {
    expect(translateAuthError({ message: 'Invalid API key', code: 'invalid_api_key', status: 401 })).toBe(
      'ตั้งค่า Supabase key ไม่ถูกต้อง',
    );
    expect(translateAuthError({ message: 'anything', code: 'invalid_api_key' })).toBe(
      'ตั้งค่า Supabase key ไม่ถูกต้อง',
    );
    expect(translateAuthError({ message: 'Invalid API key' })).toBe('ตั้งค่า Supabase key ไม่ถูกต้อง');
    expect(translateAuthError({ message: 'Unauthorized', status: 401 })).toBe('ตั้งค่า Supabase key ไม่ถูกต้อง');
  });

  it('keeps invalid_credentials priority even when status is 401', () => {
    expect(translateAuthError({ message: 'anything', code: 'invalid_credentials', status: 401 })).toBe(
      'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    );
    expect(translateAuthError({ message: 'Invalid login credentials', status: 401 })).toBe(
      'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    );
  });
});
