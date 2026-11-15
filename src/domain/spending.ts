import type {
  CategorySpend,
  FinanceData,
  PeriodKey,
  PeriodSpending,
  SummaryCategory,
} from '../types/finance';

export type { CategorySpend, PeriodSpending, SummaryCategory };

/** Computes spending by category for a pay period (SPEC §3 & §6). */
export function spendingByCategory(data: FinanceData, periodKey: PeriodKey): PeriodSpending {
  void data;
  void periodKey;
  throw new Error('not implemented: spendingByCategory');
}

/** Computes spending summaries across the last `n` pay periods ending at `periodKey` (SPEC §3 & §6). */
export function spendingHistory(data: FinanceData, periodKey: PeriodKey, n = 6): PeriodSpending[] {
  void data;
  void periodKey;
  void n;
  throw new Error('not implemented: spendingHistory');
}
