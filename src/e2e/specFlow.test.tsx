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
      const created: Transaction = {
        id: `tx-e2e-${nextTxNum++}`,
        ...input,
        createdAt: input.createdAt ?? '2026-11-15T05:00:00.000Z',
        recurringIncomeId: input.recurringIncomeId ?? null,
        incomeDueOn: input.incomeDueOn ?? null,
      };
      db = { ...db, transactions: [created, ...db.transactions] };
      return created;
    });
    vi.spyOn(financeRepo, 'payBill').mockImplementation(async (input: PayBillInput) => {
      const existing = db.payments.find(
        (p) => p.sourceId === input.sourceId && p.statementKey === input.statementKey,
      );
      if (existing) return existing;
      const created: BillPayment = {
        id: `pay-e2e-${nextPayNum++}`,
        ...input,
        createdAt: input.createdAt ?? '2026-11-15T05:00:00.000Z',
      };
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

describe('End-to-end Phase 2 "วันจริง" walkthrough in fixture mode (Prompt 06)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T05:00:00Z')); // 12:00 Asia/Bangkok on 2026-11-16
    vi.stubEnv('VITE_USE_FIXTURES', '1');
  });

  afterEach(() => {
    cleanup();
    toast.dismiss();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('walks through all 7 real-day steps and preserves every Phase 2 invariant across /, /entries, and /plan', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRoutes />
            <AppToaster />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    // ─── Step 0: Initial state (2026-11-16) ───
    expect(await screen.findByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(screen.getByTestId('play-left').textContent).toBe('฿662.07');
    expect(screen.getByTestId('essential-pot').textContent).toContain('฿7,200.00');
    expect(screen.getByTestId('owed').textContent).toBe('฿2,458.93');
    expect(screen.getByTestId('income-due-cards').textContent).toContain('เงินจากแม่เข้าแล้ว?');
    expect(screen.getByTestId('income-due-cards').textContent).toContain('฿5,100.00');
    expect(screen.getByTestId('available-card').textContent).toContain('−฿1,582.07');

    // Navigate to /plan and check Step 0 numbers
    fireEvent.click(screen.getByRole('link', { name: 'แผน' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'แผน' })).toBeTruthy();
    expect(screen.getByTestId('account-balance-card').textContent).toContain('฿4,680.00');
    const forecastCard0 = screen.getByTestId('forecast-card');
    expect(forecastCard0.textContent).toContain('−฿1,582.07');
    expect(forecastCard0.textContent).toContain('+฿5,100.00');
    // Card bill ฿1,077.00 is already inside potsLeft (reserved), so forecast.bills is ฿0.00 (no double deduction)
    expect(forecastCard0.textContent).toContain('−฿0.00');
    expect(forecastCard0.textContent).toContain('−฿3,500.00');
    expect(forecastCard0.textContent).toContain('−฿7,862.07');
    expect(screen.getByTestId('forecast-timeline').textContent).toContain('฿3,603.00');

    // ─── Step 1: จดข้าว 3 อย่างด้วย 45+60+35 (= ฿140.00) บนหน้าภาพรวม ───
    fireEvent.click(screen.getByRole('link', { name: 'ภาพรวม' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const quickDialog = screen.getByRole('dialog');
    fireEvent.change(within(quickDialog).getByLabelText('จำนวนเงิน'), { target: { value: '45+60+35' } });
    expect(within(quickDialog).getByText('= ฿140.00')).toBeTruthy();
    fireEvent.change(within(quickDialog).getByLabelText('โน้ต (ไม่บังคับ)'), { target: { value: 'ข้าว 3 มื้อ' } });
    fireEvent.click(within(quickDialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => {
      expect(screen.getByTestId('play-left').textContent).toBe('฿522.07');
    });
    expect(screen.getByTestId('essential-pot').textContent).toContain('฿7,200.00');
    expect(screen.getByTestId('available-card').textContent).toContain('−฿1,582.07');

    // ─── Step 2: กด hot bar ข้าวมันไก่ ฿45 (ผูก pot-essential ใช้จ่ายจำเป็น) ───
    fireEvent.click(screen.getByRole('button', { name: 'ข้าวมันไก่ ฿45' }));
    await waitFor(() => {
      expect(screen.getByTestId('essential-pot').textContent).toContain('฿7,155.00');
    });
    expect(screen.getByTestId('play-left').textContent).toBe('฿522.07');
    expect(screen.getByTestId('available-card').textContent).toContain('−฿1,582.07');

    // ─── Step 3: เช็กยอดเจอหายไป ฿130 (ในแอปควรเหลือ ฿4,495.00 vs ยอดจริง ฿4,365.00) ───
    fireEvent.click(screen.getByRole('link', { name: 'แผน' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'แผน' })).toBeTruthy();
    expect(screen.getByTestId('account-balance-card').textContent).toContain('฿4,495.00');
    expect(screen.getByTestId('forecast-card').textContent).toContain('−฿1,582.07');
    expect(screen.getByTestId('forecast-card').textContent).toContain('−฿7,677.07');

    fireEvent.click(screen.getByRole('button', { name: 'เช็กกับยอดจริง' }));
    const checkDialog = screen.getByRole('dialog');
    expect(checkDialog.textContent).toContain('฿4,495.00');
    fireEvent.change(within(checkDialog).getByLabelText('ยอดจริงในบัญชี'), { target: { value: '4365' } });
    expect(within(checkDialog).getByText('หายไป — ลืมจดอะไรไหม?')).toBeTruthy();
    expect(checkDialog.textContent).toContain('฿130.00');

    // ─── Step 4: จดที่ลืมใน sheet เช็กยอด (฿50.00 วินมอเตอร์ไซค์ หมวด เดินทาง) -> ส่วนต่างอัปเดตสดเหลือ ฿80.00 ───
    fireEvent.click(within(checkDialog).getByRole('button', { name: 'จดรายการที่ลืม' }));
    fireEvent.change(within(checkDialog).getByLabelText('จำนวนเงินที่ลืม'), { target: { value: '50' } });
    fireEvent.click(within(checkDialog).getByRole('button', { name: 'เดินทาง' }));
    fireEvent.change(within(checkDialog).getByLabelText('โน้ต'), { target: { value: 'วินมอเตอร์ไซค์' } });
    fireEvent.click(within(checkDialog).getByRole('button', { name: 'เพิ่มรายจ่าย' }));

    await waitFor(() => {
      expect(checkDialog.textContent).toContain('฿4,445.00');
      expect(checkDialog.textContent).toContain('฿80.00');
    });

    // ─── Step 5: บันทึกส่วนต่างเป็น ลืมจด (฿80.00) ───
    fireEvent.click(within(checkDialog).getByRole('button', { name: 'บันทึกส่วนต่างเป็น ลืมจด' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByTestId('account-balance-card').textContent).toContain('฿4,365.00');
    // PotsLeft is unchanged by unknown adjustment (472.07 + 7,155.00 = 7,627.07), while available drops by ฿80 to −฿1,662.07
    expect(screen.getByTestId('forecast-card').textContent).toContain('−฿7,627.07');
    expect(screen.getByTestId('forecast-card').textContent).toContain('−฿1,662.07');
    expect(screen.getByTestId('balance-check-history').textContent).toContain('ต่าง −฿80.00 (ลืมจด)');

    // ─── Step 6: แผนรอบนี้ กด เก็บแล้ว (฿2,000.00) ───
    const planSection = screen.getByTestId('plan-items-section');
    fireEvent.click(within(planSection).getByRole('button', { name: 'เก็บแล้ว' }));
    await waitFor(() => {
      expect(screen.getByTestId('account-balance-card').textContent).toContain('฿2,365.00');
    });
    // Plans remaining drops from 3,500 to 1,500; potsLeft stays 7,627.07; available stays −฿1,662.07!
    expect(screen.getByTestId('forecast-card').textContent).toContain('−฿1,500.00');
    expect(screen.getByTestId('forecast-card').textContent).toContain('−฿7,627.07');
    expect(screen.getByTestId('forecast-card').textContent).toContain('−฿1,662.07');

    // Verify Overview pots did NOT change from unknown/savings and AvailableCard matches /plan
    fireEvent.click(screen.getByRole('link', { name: 'ภาพรวม' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(screen.getByTestId('play-left').textContent).toBe('฿472.07');
    expect(screen.getByTestId('essential-pot').textContent).toContain('฿7,155.00');
    expect(screen.getByTestId('available-card').textContent).toContain('−฿1,662.07');

    // ─── Step 7: เงินจากแม่เข้า (กด เข้าแล้ว ฿5,100.00) ───
    const incomeCard = screen.getByTestId('income-due-cards');
    fireEvent.click(within(incomeCard).getByRole('button', { name: 'เข้าแล้ว' }));
    await waitFor(() => {
      expect(screen.queryByTestId('income-due-cards')).toBeNull();
    });
    // Overview available flips to +฿3,437.93 while pots remain untouched
    expect(screen.getByTestId('play-left').textContent).toBe('฿472.07');
    expect(screen.getByTestId('essential-pot').textContent).toContain('฿7,155.00');
    expect(screen.getByTestId('available-card').textContent).toContain('฿3,437.93');

    // Verify /plan matches Overview "ใช้ได้จริง" (฿3,437.93) and expected balance is ฿7,465.00
    fireEvent.click(screen.getByRole('link', { name: 'แผน' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'แผน' })).toBeTruthy();
    expect(screen.getByTestId('account-balance-card').textContent).toContain('฿7,465.00');
    expect(screen.getByTestId('forecast-card').textContent).toContain('฿3,437.93');
    expect(screen.getByTestId('forecast-timeline').textContent).toContain('฿6,388.00');

    // Verify /entries?view=summary shows totalSpend ฿3,193.93, savedThisPeriod ฿2,000.00, and unknownTotal ฿80.00
    fireEvent.click(screen.getByRole('link', { name: 'รายการ' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'รายการ' })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('tablist', { name: 'มุมมอง' })).getByRole('tab', { name: 'สรุป' }));
    expect(await screen.findByTestId('summary-total')).toBeTruthy();
    expect(screen.getByTestId('summary-total').textContent).toContain('฿3,193.93');
    expect(screen.getByTestId('summary-saved').textContent).toContain('฿2,000.00');
    expect(screen.getByTestId('summary-unknown').textContent).toContain('฿80.00');
  });

  it('closes new Phase 2 sheets on Escape and restores focus to the trigger button', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRoutes />
            <AppToaster />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();

    // 1. ConfirmIncomeSheet from IncomeDueCard "แก้ยอด/วัน"
    const editIncomeBtn = screen.getByRole('button', { name: 'แก้ยอด/วัน' });
    editIncomeBtn.focus();
    fireEvent.click(editIncomeBtn);
    const incomeDialog = screen.getByRole('dialog');
    within(incomeDialog).getByLabelText('จำนวนเงิน').focus();
    fireEvent.keyDown(incomeDialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(editIncomeBtn));

    // 2. BalanceCheckSheet & PlanItemSheet on /plan
    fireEvent.click(screen.getByRole('link', { name: 'แผน' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'แผน' })).toBeTruthy();

    const checkBtn = screen.getByRole('button', { name: 'เช็กกับยอดจริง' });
    checkBtn.focus();
    fireEvent.click(checkBtn);
    const checkDialog = screen.getByRole('dialog');
    within(checkDialog).getByLabelText('ยอดจริงในบัญชี').focus();
    fireEvent.keyDown(checkDialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(checkBtn));

    const addPlanBtn = screen.getByRole('button', { name: 'เพิ่มแผน' });
    addPlanBtn.focus();
    fireEvent.click(addPlanBtn);
    const planDialog = screen.getByRole('dialog');
    within(planDialog).getByLabelText('ชื่อรายการ').focus();
    fireEvent.keyDown(planDialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(addPlanBtn));
  });
});
