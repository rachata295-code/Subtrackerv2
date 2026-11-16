import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import * as financeRepo from '../data/financeRepo';
import {
  useClearAllData,
  useCompletePlanItem,
  useConfirmIncome,
  useCreateBalanceCheck,
  useCreateTransaction,
  useCreateTransactions,
  useDeleteBillPayment,
  useDeletePlanItem,
  useDeleteRecurringIncome,
  useFinanceData,
  usePayBill,
  useUncompletePlanItem,
  useUpdateSettings,
  useUpsertPlanItem,
  useUpsertRecurringIncome,
} from './useFinance';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('useFinance hooks in fixture mode', () => {
  it('returns financeFixture from useFinanceData', () => {
    vi.stubEnv('VITE_USE_FIXTURES', '1');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFinanceData(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(financeFixture);
  });

  it('keeps usePayBill idempotent in fixture mode', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '1');
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        finance: useFinanceData(),
        payBill: usePayBill(),
      }),
      { wrapper },
    );

    const input = {
      sourceId: 'src-card',
      statementKey: '2026-11',
      amount: 107700,
      paidOn: '2026-11-24',
    };

    let firstId = '';
    let secondId = '';
    await act(async () => {
      const first = await result.current.payBill.mutateAsync(input);
      const second = await result.current.payBill.mutateAsync(input);
      firstId = first.id;
      secondId = second.id;
    });

    expect(firstId).toBe(secondId);
    await waitFor(() => {
      const matching = result.current.finance.data?.payments.filter(
        (p) => p.sourceId === 'src-card' && p.statementKey === '2026-11',
      );
      expect(matching).toHaveLength(1);
    });
  });
});

describe('useFinance hooks with TanStack Query + mocked repo', () => {
  it('loads data from financeRepo and invalidates ["finance"] on mutations', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

    const loadSpy = vi.spyOn(financeRepo, 'loadFinanceData').mockResolvedValue(financeFixture);
    const createTxSpy = vi.spyOn(financeRepo, 'createTransaction').mockResolvedValue({
      id: 'tx-created',
      date: '2026-11-15',
      amount: 5000,
      direction: 'out',
      sourceId: 'src-bank',
      potId: 'pot-play',
      category: 'food',
      note: 'ข้าว',
      createdAt: '2026-11-15T05:00:00.000Z',
      recurringIncomeId: null,
      incomeDueOn: null,
    });
    const updateSettingsSpy = vi.spyOn(financeRepo, 'updateSettings').mockResolvedValue({
      userId: 'u1',
      salary: 1200000,
      payDay: 10,
      budgetStartPeriod: null,
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => ({
        finance: useFinanceData(),
        createTx: useCreateTransaction(),
        updateSettings: useUpdateSettings(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.finance.isLoading).toBe(false));
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(result.current.finance.data).toEqual(financeFixture);

    await act(async () => {
      await result.current.createTx.mutateAsync({
        date: '2026-11-15',
        amount: 5000,
        direction: 'out',
        sourceId: 'src-bank',
        potId: 'pot-play',
        category: 'food',
        note: 'ข้าว',
      });
    });

    expect(createTxSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['finance'] });

    await act(async () => {
      await result.current.updateSettings.mutateAsync({ salary: 1200000, payDay: 10 });
    });

    expect(updateSettingsSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['finance'] });
  });

  it('calls payBill and invalidates ["finance"] in remote mode', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

    vi.spyOn(financeRepo, 'loadFinanceData').mockResolvedValue(financeFixture);
    const payBillSpy = vi.spyOn(financeRepo, 'payBill').mockResolvedValue({
      id: 'pay-remote',
      sourceId: 'src-card',
      statementKey: '2026-11',
      amount: 107700,
      paidOn: '2026-11-24',
      createdAt: '2026-11-24T09:00:00.000Z',
    });

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePayBill(), { wrapper });

    await act(async () => {
      const payment = await result.current.mutateAsync({
        sourceId: 'src-card',
        statementKey: '2026-11',
        amount: 107700,
        paidOn: '2026-11-24',
      });
      expect(payment.id).toBe('pay-remote');
    });

    expect(payBillSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['finance'] });
  });

  it('surfaces a clear Thai error when Supabase env vars are missing outside fixture mode', () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFinanceData(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error?.message).toMatch(/VITE_SUPABASE_URL/);
  });

  it('exposes refetch on useFinanceData and supports useDeleteBillPayment for undo', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '1');
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        finance: useFinanceData(),
        payBill: usePayBill(),
        deleteBillPayment: useDeleteBillPayment(),
      }),
      { wrapper },
    );

    expect(typeof result.current.finance.refetch).toBe('function');

    let paymentId = '';
    await act(async () => {
      const created = await result.current.payBill.mutateAsync({
        sourceId: 'src-card',
        statementKey: '2026-11',
        amount: 107700,
        paidOn: '2026-11-24',
      });
      paymentId = created.id;
    });

    await waitFor(() => {
      expect(
        result.current.finance.data?.payments.some((p) => p.id === paymentId),
      ).toBe(true);
    });

    await act(async () => {
      await result.current.deleteBillPayment.mutateAsync(paymentId);
    });

    await waitFor(() => {
      expect(
        result.current.finance.data?.payments.some((p) => p.id === paymentId),
      ).toBe(false);
    });
  });

  it('supports Phase 2 mutations in fixture mode with Supabase-equivalent side effects', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '1');
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        finance: useFinanceData(),
        createTransactions: useCreateTransactions(),
        createBalanceCheck: useCreateBalanceCheck(),
        upsertPlanItem: useUpsertPlanItem(),
        completePlanItem: useCompletePlanItem(),
        uncompletePlanItem: useUncompletePlanItem(),
        deletePlanItem: useDeletePlanItem(),
        upsertRecurringIncome: useUpsertRecurringIncome(),
        confirmIncome: useConfirmIncome(),
        deleteRecurringIncome: useDeleteRecurringIncome(),
      }),
      { wrapper },
    );

    const baseTxCount = financeFixture.transactions.length;
    const baseCheckCount = financeFixture.balanceChecks.length;

    // 1. Empty batch is a no-op
    await act(async () => {
      const empty = await result.current.createTransactions.mutateAsync([]);
      expect(empty).toEqual([]);
    });
    expect(result.current.finance.data?.transactions).toHaveLength(baseTxCount);

    // 2. Non-empty batch adds transactions immediately
    await act(async () => {
      const created = await result.current.createTransactions.mutateAsync([
        {
          date: '2026-11-15',
          amount: 4_500,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'food',
          note: 'ข้าวมันไก่',
        },
        {
          date: '2026-11-15',
          amount: 8_500,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'food',
          note: 'ชานม',
        },
      ]);
      expect(created).toHaveLength(2);
    });
    await waitFor(() => {
      expect(result.current.finance.data?.transactions).toHaveLength(baseTxCount + 2);
    });

    // 3. Balance check with adjustment creates 'unknown' tx before check
    let createdCheckId = '';
    let adjTxId: string | null = null;
    await act(async () => {
      const check = await result.current.createBalanceCheck.mutateAsync({
        sourceId: 'src-bank',
        checkedOn: '2026-11-15',
        actual: 450_000,
        expectedBefore: 463_500,
        adjustment: { amount: 13_500, direction: 'out' },
      });
      createdCheckId = check.id;
      adjTxId = check.adjustmentTxId;
      expect(check.adjustmentTxId).toBeTruthy();
    });
    await waitFor(() => {
      const check = result.current.finance.data?.balanceChecks.find((c) => c.id === createdCheckId);
      const adjTx = result.current.finance.data?.transactions.find((t) => t.id === adjTxId);
      expect(check).toBeDefined();
      expect(adjTx?.category).toBe('unknown');
      expect(adjTx?.date).toBe('2026-11-15');
      expect(adjTx?.potId).toBeNull();
      expect(adjTx && check && adjTx.createdAt < check.createdAt).toBe(true);
      expect(result.current.finance.data?.balanceChecks).toHaveLength(baseCheckCount + 1);
    });

    // 4. Plan item save -> complete creates 'savings' tx -> uncomplete deletes tx
    let doneTxId: string | null = null;
    await act(async () => {
      const completed = await result.current.completePlanItem.mutateAsync('plan-save');
      doneTxId = completed.doneTxId;
      expect(doneTxId).toBeTruthy();
    });
    await waitFor(() => {
      const tx = result.current.finance.data?.transactions.find((t) => t.id === doneTxId);
      expect(tx?.category).toBe('savings');
      expect(tx?.potId).toBeNull();
      expect(tx?.direction).toBe('out');
    });

    await act(async () => {
      const uncompleted = await result.current.uncompletePlanItem.mutateAsync('plan-save');
      expect(uncompleted.doneTxId).toBeNull();
    });
    await waitFor(() => {
      expect(result.current.finance.data?.transactions.some((t) => t.id === doneTxId)).toBe(false);
    });

    // 5. Confirm recurring income creates 'allowance' in tx and delete clears recurringIncomeId
    let confirmedTxId = '';
    await act(async () => {
      const tx = await result.current.confirmIncome.mutateAsync({
        recurringIncomeId: 'inc-mom-10',
        incomeDueOn: '2026-11-10',
        amount: 510_000,
        date: '2026-11-10',
      });
      confirmedTxId = tx.id;
      expect(tx.direction).toBe('in');
      expect(tx.category).toBe('allowance');
      expect(tx.note).toBe('เงินจากแม่');
      await result.current.deleteRecurringIncome.mutateAsync('inc-mom-10');
    });
    await waitFor(() => {
      const linkedAfterDelete = result.current.finance.data?.transactions.find(
        (t) => t.id === confirmedTxId,
      );
      expect(linkedAfterDelete?.recurringIncomeId).toBeNull();
    });
  });
});

describe('useCreateTransactions optimistic update and rollback', () => {
  it('optimistically inserts transactions before remote resolve and invalidates on success', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

    vi.spyOn(financeRepo, 'loadFinanceData').mockResolvedValue(financeFixture);

    let resolveBatch!: (value: financeRepo.TransactionRow[] extends never ? never : typeof financeFixture.transactions) => void;
    const pendingPromise = new Promise<typeof financeFixture.transactions>((res) => {
      resolveBatch = res;
    });
    const batchSpy = vi.spyOn(financeRepo, 'createTransactions').mockReturnValue(pendingPromise);

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => ({
        finance: useFinanceData(),
        createTransactions: useCreateTransactions(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.finance.isLoading).toBe(false));
    const initialCount = result.current.finance.data!.transactions.length;

    let mutationPromise!: Promise<typeof financeFixture.transactions>;
    act(() => {
      mutationPromise = result.current.createTransactions.mutateAsync([
        {
          date: '2026-11-15',
          amount: 4_500,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'food',
          note: 'ข้าวมันไก่',
        },
      ]);
    });

    // Optimistic transaction is immediately visible while remote request is still in-flight
    await waitFor(() => {
      expect(result.current.finance.data?.transactions).toHaveLength(initialCount + 1);
    });
    expect(result.current.finance.data?.transactions[0]?.note).toBe('ข้าวมันไก่');
    expect(result.current.finance.data?.transactions[0]?.amount).toBe(4_500);

    await act(async () => {
      resolveBatch([
        {
          id: 'tx-server-1',
          date: '2026-11-15',
          amount: 4_500,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'food',
          note: 'ข้าวมันไก่',
          createdAt: '2026-11-15T10:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
      ]);
      await mutationPromise;
    });

    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['finance'] });
  });

  it('rolls back optimistic transactions when remote createTransactions rejects', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

    vi.spyOn(financeRepo, 'loadFinanceData').mockResolvedValue(financeFixture);
    let rejectBatch!: (reason?: unknown) => void;
    const failingPromise = new Promise<typeof financeFixture.transactions>((_res, rej) => {
      rejectBatch = rej;
    });
    vi.spyOn(financeRepo, 'createTransactions').mockReturnValue(failingPromise);

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        finance: useFinanceData(),
        createTransactions: useCreateTransactions(),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.finance.isLoading).toBe(false));
    const initialTransactions = result.current.finance.data!.transactions;

    let mutationPromise!: Promise<typeof financeFixture.transactions>;
    act(() => {
      mutationPromise = result.current.createTransactions.mutateAsync([
        {
          date: '2026-11-15',
          amount: 4_500,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'food',
          note: 'ข้าวมันไก่',
        },
      ]);
    });

    await waitFor(() => {
      expect(result.current.finance.data?.transactions).toHaveLength(initialTransactions.length + 1);
    });

    await act(async () => {
      rejectBatch(new Error('บันทึกรายการไม่สำเร็จ'));
      await expect(mutationPromise).rejects.toThrow('บันทึกรายการไม่สำเร็จ');
    });

    await waitFor(() => {
      expect(result.current.finance.data?.transactions).toEqual(initialTransactions);
    });
  });

  it('calls Phase 2 repo mutations and invalidates ["finance"] in remote mode', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

    vi.spyOn(financeRepo, 'loadFinanceData').mockResolvedValue(financeFixture);
    const checkSpy = vi.spyOn(financeRepo, 'createBalanceCheck').mockResolvedValue(
      financeFixture.balanceChecks[0]!,
    );
    const upsertPlanSpy = vi.spyOn(financeRepo, 'upsertPlanItem').mockResolvedValue(
      financeFixture.planItems[0]!,
    );
    const deletePlanSpy = vi.spyOn(financeRepo, 'deletePlanItem').mockResolvedValue(undefined);
    const completePlanSpy = vi.spyOn(financeRepo, 'completePlanItem').mockResolvedValue({
      ...financeFixture.planItems[0]!,
      doneTxId: 'tx-done',
    });
    const uncompletePlanSpy = vi.spyOn(financeRepo, 'uncompletePlanItem').mockResolvedValue(
      financeFixture.planItems[0]!,
    );
    const upsertIncomeSpy = vi.spyOn(financeRepo, 'upsertRecurringIncome').mockResolvedValue(
      financeFixture.recurringIncomes[0]!,
    );
    const deleteIncomeSpy = vi.spyOn(financeRepo, 'deleteRecurringIncome').mockResolvedValue(undefined);
    const confirmIncomeSpy = vi.spyOn(financeRepo, 'confirmIncome').mockResolvedValue(
      financeFixture.transactions[0]!,
    );

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => ({
        createBalanceCheck: useCreateBalanceCheck(),
        upsertPlanItem: useUpsertPlanItem(),
        deletePlanItem: useDeletePlanItem(),
        completePlanItem: useCompletePlanItem(),
        uncompletePlanItem: useUncompletePlanItem(),
        upsertRecurringIncome: useUpsertRecurringIncome(),
        deleteRecurringIncome: useDeleteRecurringIncome(),
        confirmIncome: useConfirmIncome(),
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.createBalanceCheck.mutateAsync({
        sourceId: 'src-bank',
        actual: 510_000,
        expectedBefore: null,
      });
      await result.current.upsertPlanItem.mutateAsync({
        periodKey: '2026-11',
        name: 'ค่าหอ',
        amount: 150_000,
        kind: 'pay',
        sourceId: 'src-bank',
        dueOn: '2026-11-25',
        category: 'bills',
      });
      await result.current.completePlanItem.mutateAsync('plan-dorm');
      await result.current.uncompletePlanItem.mutateAsync('plan-dorm');
      await result.current.deletePlanItem.mutateAsync('plan-dorm');
      await result.current.upsertRecurringIncome.mutateAsync({
        name: 'เงินจากแม่',
        amount: 510_000,
        dayOfMonth: 10,
        sourceId: 'src-bank',
        active: true,
      });
      await result.current.confirmIncome.mutateAsync({
        recurringIncomeId: 'inc-mom-10',
        incomeDueOn: '2026-11-10',
        amount: 510_000,
        date: '2026-11-10',
      });
      await result.current.deleteRecurringIncome.mutateAsync('inc-mom-10');
    });

    expect(checkSpy).toHaveBeenCalledTimes(1);
    expect(upsertPlanSpy).toHaveBeenCalledTimes(1);
    expect(completePlanSpy).toHaveBeenCalledTimes(1);
    expect(uncompletePlanSpy).toHaveBeenCalledTimes(1);
    expect(deletePlanSpy).toHaveBeenCalledTimes(1);
    expect(upsertIncomeSpy).toHaveBeenCalledTimes(1);
    expect(confirmIncomeSpy).toHaveBeenCalledTimes(1);
    expect(deleteIncomeSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledTimes(8);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['finance'] });
  });

  it('useClearAllData clears fixture data appropriately with includeSetup false vs true', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '1');
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        finance: useFinanceData(),
        clearAll: useClearAllData(),
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.clearAll.mutateAsync({ includeSetup: false });
    });

    await waitFor(() => expect(result.current.finance.data?.transactions).toEqual([]));
    expect(result.current.finance.data?.payments).toEqual([]);
    expect(result.current.finance.data?.balanceChecks).toEqual([]);
    expect(result.current.finance.data?.planItems).toEqual([]);
    expect(result.current.finance.data?.subscriptions).toEqual([]);
    expect(result.current.finance.data?.installments).toEqual([]);
    // Setup stays intact when includeSetup is false.
    expect(result.current.finance.data?.sources).toEqual(financeFixture.sources);
    expect(result.current.finance.data?.pots).toEqual(financeFixture.pots);
    expect(result.current.finance.data?.recurringIncomes).toEqual(financeFixture.recurringIncomes);
    expect(result.current.finance.data?.settings).toEqual(financeFixture.settings);

    await act(async () => {
      await result.current.clearAll.mutateAsync({ includeSetup: true });
    });

    await waitFor(() => expect(result.current.finance.data?.recurringIncomes).toEqual([]));
    expect(result.current.finance.data?.sources).toHaveLength(3);
    expect(result.current.finance.data?.pots).toHaveLength(2);
    expect(result.current.finance.data?.settings).toEqual({
      userId: financeFixture.settings.userId,
      salary: 1_020_000,
      payDay: 10,
      budgetStartPeriod: null,
    });
  });

  it('useClearAllData invalidates queries even when remote clearAllData fails mid-way', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');

    vi.spyOn(financeRepo, 'loadFinanceData').mockResolvedValue(financeFixture);
    const clearSpy = vi.spyOn(financeRepo, 'clearAllData').mockRejectedValueOnce(new Error('ล้างข้อมูลไม่สำเร็จ'));

    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useClearAllData(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ includeSetup: false })).rejects.toThrow(/ล้างข้อมูลไม่สำเร็จ/);
    });

    expect(clearSpy).toHaveBeenCalledWith({ includeSetup: false });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
  });
});
