import { financeFixture } from '../fixtures/finance';
import type {
  BillPayment,
  CreateTransactionInput,
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

const useFixtures = () => import.meta.env.VITE_USE_FIXTURES === '1';

// Stub data hook; prompt 01 replaces the body with TanStack Query + Supabase repo calls.
export function useFinanceData(): UseFinanceData {
  if (useFixtures()) {
    return { data: financeFixture, isLoading: false, error: null };
  }
  return { data: undefined, isLoading: false, error: null };
}

export function useUpdateSettings(): UseFinanceMutation<UpdateSettingsInput, Settings> {
  return {
    // TODO(prompt-01): persist settings update via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async (input) => ({ userId: 'fixture-user', ...input }),
    isPending: false,
    error: null,
  };
}

export function useUpsertSource(): UseFinanceMutation<UpsertSourceInput, PaymentSource> {
  return {
    // TODO(prompt-01): upsert payment source via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async (input) => ({ id: input.id ?? 'stub-source', ...input }),
    isPending: false,
    error: null,
  };
}

export function useDeleteSource(): UseFinanceMutation<string> {
  return {
    // TODO(prompt-01): delete payment source via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async () => {},
    isPending: false,
    error: null,
  };
}

export function useUpsertPot(): UseFinanceMutation<UpsertPotInput, Pot> {
  return {
    // TODO(prompt-01): upsert pot via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async (input) => ({ id: input.id ?? 'stub-pot', ...input }),
    isPending: false,
    error: null,
  };
}

export function useDeletePot(): UseFinanceMutation<string> {
  return {
    // TODO(prompt-01): delete pot via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async () => {},
    isPending: false,
    error: null,
  };
}

export function useUpsertSubscription(): UseFinanceMutation<UpsertSubscriptionInput, Subscription> {
  return {
    // TODO(prompt-01): upsert subscription via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async (input) => ({ id: input.id ?? 'stub-sub', ...input }),
    isPending: false,
    error: null,
  };
}

export function useDeleteSubscription(): UseFinanceMutation<string> {
  return {
    // TODO(prompt-01): delete subscription via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async () => {},
    isPending: false,
    error: null,
  };
}

export function useUpsertInstallment(): UseFinanceMutation<UpsertInstallmentInput, Installment> {
  return {
    // TODO(prompt-01): upsert installment via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async (input) => ({ id: input.id ?? 'stub-inst', ...input }),
    isPending: false,
    error: null,
  };
}

export function useDeleteInstallment(): UseFinanceMutation<string> {
  return {
    // TODO(prompt-01): delete installment via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async () => {},
    isPending: false,
    error: null,
  };
}

export function useCreateTransaction(): UseFinanceMutation<CreateTransactionInput, Transaction> {
  return {
    // TODO(prompt-01): insert transaction via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async (input) => ({ id: 'stub-tx', ...input }),
    isPending: false,
    error: null,
  };
}

export function useUpdateTransaction(): UseFinanceMutation<Transaction, Transaction> {
  return {
    // TODO(prompt-01): update transaction via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async (input) => input,
    isPending: false,
    error: null,
  };
}

export function useDeleteTransaction(): UseFinanceMutation<string> {
  return {
    // TODO(prompt-01): delete transaction via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async () => {},
    isPending: false,
    error: null,
  };
}

export function usePayBill(): UseFinanceMutation<PayBillInput, BillPayment> {
  return {
    // TODO(prompt-01): record idempotent bill payment via Supabase repo and invalidate ['finance'].
    mutate: () => {},
    mutateAsync: async (input) => ({ id: 'stub-payment', ...input }),
    isPending: false,
    error: null,
  };
}
