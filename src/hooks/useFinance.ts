import { useContext } from 'react';
import {
  QueryClient,
  QueryClientContext,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import {
  completePlanItem,
  confirmIncome,
  createBalanceCheck,
  createTransaction,
  createTransactions,
  deleteBillPayment,
  deleteInstallment,
  deletePlanItem,
  deletePot,
  deleteRecurringIncome,
  deleteSource,
  deleteSubscription,
  deleteTransaction,
  loadFinanceData,
  payBill,
  uncompletePlanItem,
  updateSettings,
  updateTransaction,
  upsertInstallment,
  upsertPlanItem,
  upsertPot,
  upsertRecurringIncome,
  upsertSource,
  upsertSubscription,
} from '../data/financeRepo';
import { financeFixture } from '../fixtures/finance';
import { getSupabaseConfigError, isFixturesMode } from '../lib/supabase';
import type {
  BalanceCheck,
  BillPayment,
  ConfirmIncomeInput,
  CreateBalanceCheckInput,
  CreateTransactionInput,
  CreateTransactionsInput,
  FinanceData,
  ISODate,
  Installment,
  PayBillInput,
  PaymentSource,
  PlanItem,
  Pot,
  RecurringIncome,
  Settings,
  Subscription,
  Transaction,
  UpdateSettingsInput,
  UpsertInstallmentInput,
  UpsertPlanItemInput,
  UpsertPotInput,
  UpsertRecurringIncomeInput,
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

function todayBangkokISO(now: Date = new Date()): ISODate {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function buildFixtureTransaction(input: CreateTransactionInput, createdAt?: string): Transaction {
  return {
    id: nextFixtureId('tx'),
    date: input.date,
    amount: input.amount,
    direction: input.direction,
    sourceId: input.sourceId,
    potId: input.potId,
    category: input.category,
    note: input.note,
    createdAt: input.createdAt ?? createdAt ?? new Date().toISOString(),
    recurringIncomeId: input.recurringIncomeId ?? null,
    incomeDueOn: input.incomeDueOn ?? null,
  };
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
      const tx = buildFixtureTransaction(input);
      return {
        data: { ...current, transactions: [tx, ...current.transactions] },
        result: tx,
      };
    },
  );
}

export function useCreateTransactions(): UseFinanceMutation<CreateTransactionsInput, Transaction[]> {
  return useFinanceMutation(
    (inputs) => createTransactions(inputs),
    (current, inputs) => {
      if (inputs.length === 0) return { data: current, result: [] };
      const nowMs = Date.now();
      const created = inputs.map((input, idx) =>
        buildFixtureTransaction(input, new Date(nowMs + idx).toISOString()),
      );
      return {
        data: { ...current, transactions: [...created, ...current.transactions] },
        result: created,
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
      const payment: BillPayment = {
        id: nextFixtureId('pay'),
        sourceId: input.sourceId,
        statementKey: input.statementKey,
        amount: input.amount,
        paidOn: input.paidOn,
        createdAt: input.createdAt ?? new Date().toISOString(),
      };
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

export function useCreateBalanceCheck(): UseFinanceMutation<CreateBalanceCheckInput, BalanceCheck> {
  return useFinanceMutation(
    (input) => createBalanceCheck(input),
    (current, input) => {
      const checkedOn = input.checkedOn ?? todayBangkokISO();
      const nowMs = Date.now();
      let adjustmentTx: Transaction | null = null;

      // SPEC §5 C2: adjustment 'unknown' tx is created BEFORE the BalanceCheck so it is never counted after the checkpoint.
      if (input.adjustment && input.adjustment.amount > 0) {
        adjustmentTx = buildFixtureTransaction(
          {
            date: checkedOn,
            amount: input.adjustment.amount,
            direction: input.adjustment.direction,
            sourceId: input.sourceId,
            potId: null,
            category: 'unknown',
            note: input.adjustment.note ?? 'ส่วนต่างเช็กยอด',
          },
          new Date(nowMs - 1).toISOString(),
        );
      }

      const check: BalanceCheck = {
        id: nextFixtureId('chk'),
        sourceId: input.sourceId,
        checkedOn,
        actual: input.actual,
        expectedBefore: input.expectedBefore,
        adjustmentTxId: adjustmentTx ? adjustmentTx.id : null,
        createdAt: new Date(nowMs).toISOString(),
      };

      return {
        data: {
          ...current,
          transactions: adjustmentTx ? [adjustmentTx, ...current.transactions] : current.transactions,
          balanceChecks: [check, ...current.balanceChecks],
        },
        result: check,
      };
    },
  );
}

export function useUpsertPlanItem(): UseFinanceMutation<UpsertPlanItemInput, PlanItem> {
  return useFinanceMutation(
    (input) => upsertPlanItem(input),
    (current, input) => {
      const existing = input.id ? current.planItems.find((p) => p.id === input.id) : undefined;
      const planItem: PlanItem = {
        id: input.id ?? nextFixtureId('plan'),
        periodKey: input.periodKey,
        name: input.name,
        amount: input.amount,
        kind: input.kind,
        sourceId: input.sourceId,
        dueOn: input.dueOn,
        category: input.kind === 'save' ? 'savings' : input.category,
        doneTxId: input.doneTxId !== undefined ? input.doneTxId : (existing?.doneTxId ?? null),
        sortOrder:
          input.sortOrder !== undefined ? input.sortOrder : (existing?.sortOrder ?? current.planItems.length + 1),
      };
      return {
        data: { ...current, planItems: upsertById(current.planItems, planItem) },
        result: planItem,
      };
    },
  );
}

export function useDeletePlanItem(): UseFinanceMutation<string> {
  return useFinanceMutation(
    (id) => deletePlanItem(id),
    (current, id) => ({
      data: { ...current, planItems: current.planItems.filter((p) => p.id !== id) },
      result: undefined,
    }),
  );
}

export function useCompletePlanItem(): UseFinanceMutation<string, PlanItem> {
  return useFinanceMutation(
    (id) => completePlanItem(id),
    (current, id) => {
      const item = current.planItems.find((p) => p.id === id);
      if (!item) {
        throw new Error('ไม่พบรายการแผน');
      }
      if (item.doneTxId) {
        return { data: current, result: item };
      }
      const tx = buildFixtureTransaction({
        date: todayBangkokISO(),
        amount: item.amount,
        direction: 'out',
        sourceId: item.sourceId,
        potId: null,
        category: item.kind === 'save' ? 'savings' : item.category,
        note: item.name,
      });
      const updated: PlanItem = { ...item, doneTxId: tx.id };
      return {
        data: {
          ...current,
          transactions: [tx, ...current.transactions],
          planItems: upsertById(current.planItems, updated),
        },
        result: updated,
      };
    },
  );
}

export function useUncompletePlanItem(): UseFinanceMutation<string, PlanItem> {
  return useFinanceMutation(
    (id) => uncompletePlanItem(id),
    (current, id) => {
      const item = current.planItems.find((p) => p.id === id);
      if (!item) {
        throw new Error('ไม่พบรายการแผน');
      }
      const updated: PlanItem = { ...item, doneTxId: null };
      return {
        data: {
          ...current,
          transactions: item.doneTxId
            ? current.transactions.filter((t) => t.id !== item.doneTxId)
            : current.transactions,
          planItems: upsertById(current.planItems, updated),
        },
        result: updated,
      };
    },
  );
}

export function useUpsertRecurringIncome(): UseFinanceMutation<UpsertRecurringIncomeInput, RecurringIncome> {
  return useFinanceMutation(
    (input) => upsertRecurringIncome(input),
    (current, input) => {
      const rec: RecurringIncome = { id: input.id ?? nextFixtureId('inc'), ...input };
      return {
        data: { ...current, recurringIncomes: upsertById(current.recurringIncomes, rec) },
        result: rec,
      };
    },
  );
}

export function useDeleteRecurringIncome(): UseFinanceMutation<string> {
  return useFinanceMutation(
    (id) => deleteRecurringIncome(id),
    (current, id) => ({
      data: {
        ...current,
        recurringIncomes: current.recurringIncomes.filter((r) => r.id !== id),
        transactions: current.transactions.map((t) =>
          t.recurringIncomeId === id ? { ...t, recurringIncomeId: null } : t,
        ),
      },
      result: undefined,
    }),
  );
}

export function useConfirmIncome(): UseFinanceMutation<ConfirmIncomeInput, Transaction> {
  return useFinanceMutation(
    (input) => confirmIncome(input),
    (current, input) => {
      const rec = current.recurringIncomes.find((r) => r.id === input.recurringIncomeId);
      const sourceId =
        input.sourceId ?? rec?.sourceId ?? current.sources.find((s) => s.kind === 'bank')?.id ?? '';
      const note = input.note ?? rec?.name ?? 'เงินประจำ';
      const tx = buildFixtureTransaction({
        date: input.date,
        amount: input.amount,
        direction: 'in',
        sourceId,
        potId: null,
        category: 'allowance',
        note,
        recurringIncomeId: input.recurringIncomeId,
        incomeDueOn: input.incomeDueOn,
      });
      return {
        data: { ...current, transactions: [tx, ...current.transactions] },
        result: tx,
      };
    },
  );
}
