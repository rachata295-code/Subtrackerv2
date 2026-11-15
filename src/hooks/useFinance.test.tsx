import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import * as financeRepo from '../data/financeRepo';
import {
  useCreateTransaction,
  useFinanceData,
  usePayBill,
  useUpdateSettings,
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
    });
    const updateSettingsSpy = vi.spyOn(financeRepo, 'updateSettings').mockResolvedValue({
      userId: 'u1',
      salary: 1200000,
      payDay: 10,
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
});
