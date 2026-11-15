import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { AppRoutes } from '../App';
import { AuthProvider, type AuthChangeEvent, type AuthClient, type AuthSession, type AuthUser } from '../auth';
import { AppToaster } from '../components/ui/Toaster';
import { financeFixture } from '../fixtures/finance';
import * as financeRepo from '../data/financeRepo';
import type { BillPayment, CreateTransactionInput, FinanceData, PayBillInput, Transaction } from '../types/finance';

// Vaul calls pointer capture APIs omitted in jsdom.
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}

vi.mock('../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: vi.fn() }),
}));

/**
 * End-to-end SPEC §4 integration test using real AuthProvider, real QueryClientProvider,
 * real useFinance hooks, real domain math, and real pages (without mocking domain or hooks).
 */
describe('End-to-end SPEC §4 user flow (login -> add expense -> pay bill -> sign out)', () => {
  const TEST_USER: AuthUser = { id: 'user-spec', email: 'owner@subtracker.test' };
  let db: FinanceData;
  let nextTxNum = 1;
  let nextPayNum = 1;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T05:00:00Z')); // 12:00 Asia/Bangkok on 2026-11-15
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key-test');

    db = structuredClone(financeFixture);
    nextTxNum = 1;
    nextPayNum = 1;

    vi.spyOn(financeRepo, 'loadFinanceData').mockImplementation(async () => structuredClone(db));
    vi.spyOn(financeRepo, 'createTransaction').mockImplementation(async (input: CreateTransactionInput) => {
      const created: Transaction = { id: `tx-e2e-${nextTxNum++}`, ...input };
      db = { ...db, transactions: [created, ...db.transactions] };
      return created;
    });
    vi.spyOn(financeRepo, 'payBill').mockImplementation(async (input: PayBillInput) => {
      const existing = db.payments.find(
        (p) => p.sourceId === input.sourceId && p.statementKey === input.statementKey,
      );
      if (existing) return existing;
      const created: BillPayment = { id: `pay-e2e-${nextPayNum++}`, ...input };
      db = { ...db, payments: [created, ...db.payments] };
      return created;
    });
  });

  afterEach(() => {
    cleanup();
    toast.dismiss();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('matches SPEC §4 figures across login, adding an expense, paying a bill, and signing out', async () => {
    let currentSession: AuthSession | null = null;
    const listeners = new Set<(event: AuthChangeEvent, session: AuthSession | null) => void>();

    const authClient: AuthClient = {
      getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
      onAuthStateChange: vi.fn((cb) => {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      }),
      signInWithPassword: vi.fn(async ({ email }) => {
        const session: AuthSession = { access_token: 'tok', user: { id: TEST_USER.id, email } };
        currentSession = session;
        for (const cb of listeners) cb('SIGNED_IN', session);
        return { data: { user: session.user, session }, error: null };
      }),
      signOut: vi.fn(async () => {
        currentSession = null;
        for (const cb of listeners) cb('SIGNED_OUT', null);
        return { error: null };
      }),
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const seedDefaults = vi.fn(async () => {
      await queryClient.invalidateQueries({ queryKey: ['finance'] });
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider client={authClient} seedDefaults={seedDefaults}>
          <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRoutes />
            <AppToaster />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    // 1. Login
    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('อีเมล'), { target: { value: 'owner@subtracker.test' } });
    fireEvent.change(screen.getByLabelText('รหัสผ่าน'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));

    // 2. Overview matches SPEC §4 baseline: ฿662.07 left, ฿2,458.93 owed
    expect(await screen.findByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('play-left').textContent).toBe('฿662.07');
    });
    expect(screen.getByTestId('owed').textContent).toBe('฿2,458.93');
    expect(seedDefaults).toHaveBeenCalledTimes(1);

    // 3. Add play-pot expense ฿100.00 -> left drops to ฿562.07
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '100' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => {
      expect(screen.getByTestId('play-left').textContent).toBe('฿562.07');
    });
    expect(screen.getByTestId('owed').textContent).toBe('฿2,458.93');

    // 4. Pay credit card bill (฿1,077.00) -> owed drops to ฿1,381.93 while left stays ฿562.07 (reserved -> spent)
    const payButtons = screen.getAllByRole('button', { name: 'จ่ายแล้ว' });
    fireEvent.click(payButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('owed').textContent).toBe('฿1,381.93');
    });
    expect(screen.getByTestId('play-left').textContent).toBe('฿562.07');

    // 5. Navigate to Settings and sign out -> redirected to /login
    fireEvent.click(screen.getByRole('link', { name: 'ตั้งค่า' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ตั้งค่า' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ออกจากระบบ' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'เข้าสู่ระบบ' })).toBeTruthy();
    expect(authClient.signOut).toHaveBeenCalledTimes(1);
  });
});
