import { useContext } from 'react';
import {
  QueryClient,
  QueryClientContext,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import {
  createTransaction,
  deleteBillPayment,
  deleteInstallment,
  deletePot,
  deleteSource,
  deleteSubscription,
  deleteTransaction,
  loadFinanceData,
  payBill,
  updateSettings,
  updateTransaction,
  upsertInstallment,
  upsertPot,
  upsertSource,
  upsertSubscription,
} from '../data/financeRepo';
import { financeFixture } from '../fixtures/finance';
import { getSupabaseConfigError, isFixturesMode } from '../lib/supabase';
import type {
  BillPayment,
  CreateTransactionInput,
  FinanceData,
  Installment,
  PayBillInput,
  PaymentSource,
  Pot,
  Settings,
  Subscription,
  Transaction,
  UpdateSettingsInput,
  UpsertInstallmentInput,
  UpsertPotInput,
  UpsertSourceInput,
  UpsertSubscriptionInput,
  UseFinanceData,
  UseFinanceMutation,
} from '../types/finance';

export const FINANCE_QUERY_KEY = ['finance'] as const;

// Fallback client allows bare hook calls in contract tests without a QueryClientProvider wrapper.
const fallbackQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function useResolvedQueryClient(): QueryClient {
  return useContext(QueryClientContext) ?? fallbackQueryClient;
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) return [...items, next];
  return items.map((item, idx) => (idx === index ? next : item));
}

function nextFixtureId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function useFinanceMutation<TInput, TResult>(
  remoteFn: (input: TInput) => Promise<TResult>,
  fixtureUpdater: (current: FinanceData, input: TInput) => { data: FinanceData; result: TResult },
): UseFinanceMutation<TInput, TResult> {
  const queryClient = useResolvedQueryClient();

  const mutation = useMutation<TResult, Error, TInput>(
    {
      mutationFn: async (input) => {
        if (isFixturesMode()) {
          const current = queryClient.getQueryData<FinanceData>(FINANCE_QUERY_KEY) ?? financeFixture;
          const { data: nextData, result } = fixtureUpdater(current, input);
          queryClient.setQueryData(FINANCE_QUERY_KEY, nextData);
          return result;
        }
        return remoteFn(input);
      },
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_KEY });
      },
    },
    queryClient,
  );

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useFinanceData(): UseFinanceData {
  const queryClient = useResolvedQueryClient();
  const fixtures = isFixturesMode();
  const configError = fixtures ? null : getSupabaseConfigError();

  const query = useQuery<FinanceData, Error>(
    {
      queryKey: FINANCE_QUERY_KEY,
      queryFn: () => loadFinanceData(),
      enabled: !fixtures && !configError,
      initialData: fixtures ? financeFixture : undefined,
      staleTime: fixtures ? Infinity : 0,
    },
    queryClient,
  );

  const refetch = () => {
    void query.refetch();
  };

  if (fixtures) {
    return {
      data: query.data ?? financeFixture,
      isLoading: false,
      error: null,
      refetch,
    };
  }

  if (configError) {
    return {
      data: undefined,
      isLoading: false,
      error: configError,
      refetch,
    };
  }

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

export function useUpdateSettings(): UseFinanceMutation<UpdateSettingsInput, Settings> {
  return useFinanceMutation(
    (input) => updateSettings(input),
    (current, input) => {
      // An omitted budgetStartPeriod means "unchanged"; spreading `undefined` would wipe it.
      const { budgetStartPeriod, ...rest } = input;
      const settings: Settings = {
        ...current.settings,
        ...rest,
        ...(budgetStartPeriod !== undefined ? { budgetStartPeriod } : {}),
      };
      return { data: { ...current, settings }, result: settings };
    },
  );
}

export function useUpsertSource(): UseFinanceMutation<UpsertSourceInput, PaymentSource> {
  return useFinanceMutation(
    (input) => upsertSource(input),
    (current, input) => {
      const source: PaymentSource = { id: input.id ?? nextFixtureId('src'), ...input };
      return {
        data: { ...current, sources: upsertById(current.sources, source) },
        result: source,
      };
    },
  );
}

export function useDeleteSource(): UseFinanceMutation<string> {
  return useFinanceMutation(
    (id) => deleteSource(id),
    (current, id) => ({
      data: { ...current, sources: current.sources.filter((s) => s.id !== id) },
      result: undefined,
    }),
  );
}

export function useUpsertPot(): UseFinanceMutation<UpsertPotInput, Pot> {
  return useFinanceMutation(
    (input) => upsertPot(input),
    (current, input) => {
      const pot: Pot = { id: input.id ?? nextFixtureId('pot'), ...input };
      return {
        data: { ...current, pots: upsertById(current.pots, pot) },
        result: pot,
      };
    },
  );
}

export function useDeletePot(): UseFinanceMutation<string> {
  return useFinanceMutation(
    (id) => deletePot(id),
    (current, id) => ({
      data: { ...current, pots: current.pots.filter((p) => p.id !== id) },
      result: undefined,
    }),
  );
}

export function useUpsertSubscription(): UseFinanceMutation<UpsertSubscriptionInput, Subscription> {
  return useFinanceMutation(
    (input) => upsertSubscription(input),
    (current, input) => {
      const sub: Subscription = { id: input.id ?? nextFixtureId('sub'), ...input };
      return {
        data: { ...current, subscriptions: upsertById(current.subscriptions, sub) },
        result: sub,
      };
    },
  );
}

export function useDeleteSubscription(): UseFinanceMutation<string> {
  return useFinanceMutation(
    (id) => deleteSubscription(id),
    (current, id) => ({
      data: { ...current, subscriptions: current.subscriptions.filter((s) => s.id !== id) },
      result: undefined,
    }),
  );
}

export function useUpsertInstallment(): UseFinanceMutation<UpsertInstallmentInput, Installment> {
  return useFinanceMutation(
    (input) => upsertInstallment(input),
    (current, input) => {
      const inst: Installment = { id: input.id ?? nextFixtureId('inst'), ...input };
      return {
        data: { ...current, installments: upsertById(current.installments, inst) },
        result: inst,
      };
    },
  );
}

export function useDeleteInstallment(): UseFinanceMutation<string> {
  return useFinanceMutation(
    (id) => deleteInstallment(id),
    (current, id) => ({
      data: { ...current, installments: current.installments.filter((i) => i.id !== id) },
      result: undefined,
    }),
  );
}

export function useCreateTransaction(): UseFinanceMutation<CreateTransactionInput, Transaction> {
  return useFinanceMutation(
    (input) => createTransaction(input),
    (current, input) => {
      const tx: Transaction = { id: nextFixtureId('tx'), ...input };
      return {
        data: { ...current, transactions: [tx, ...current.transactions] },
        result: tx,
      };
    },
  );
}

export function useUpdateTransaction(): UseFinanceMutation<Transaction, Transaction> {
  return useFinanceMutation(
    (input) => updateTransaction(input),
    (current, input) => ({
      data: { ...current, transactions: upsertById(current.transactions, input) },
      result: input,
    }),
  );
}

export function useDeleteTransaction(): UseFinanceMutation<string> {
  return useFinanceMutation(
    (id) => deleteTransaction(id),
    (current, id) => ({
      data: { ...current, transactions: current.transactions.filter((t) => t.id !== id) },
      result: undefined,
    }),
  );
}

export function usePayBill(): UseFinanceMutation<PayBillInput, BillPayment> {
  return useFinanceMutation(
    (input) => payBill(input),
    (current, input) => {
      const existing = current.payments.find(
        (p) => p.sourceId === input.sourceId && p.statementKey === input.statementKey,
      );
      if (existing) {
        return { data: current, result: existing };
      }
      const payment: BillPayment = { id: nextFixtureId('pay'), ...input };
      return {
        data: { ...current, payments: [payment, ...current.payments] },
        result: payment,
      };
    },
  );
}

export function useDeleteBillPayment(): UseFinanceMutation<string> {
  return useFinanceMutation(
    (id) => deleteBillPayment(id),
    (current, id) => ({
      data: { ...current, payments: current.payments.filter((p) => p.id !== id) },
      result: undefined,
    }),
  );
}
