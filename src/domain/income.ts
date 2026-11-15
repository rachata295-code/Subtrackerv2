import type { FinanceData, ISODate, PendingIncome } from '../types/finance';

export type { PendingIncome };

/** Returns active recurring incomes due on or before `today` in the current period that have no confirmed transaction yet (SPEC §5 C7 & §6). */
export function pendingIncomes(data: FinanceData, today: ISODate): PendingIncome[] {
  void data;
  void today;
  throw new Error('not implemented: pendingIncomes');
}
