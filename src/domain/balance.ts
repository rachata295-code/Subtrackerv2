import type { FinanceData, Satang } from '../types/finance';

/** Computes the expected bank account balance from the latest BalanceCheck and subsequent activity (SPEC §5 C2 & §6). */
export function expectedBalance(sourceId: string, data: FinanceData): Satang | null {
  void sourceId;
  void data;
  throw new Error('not implemented: expectedBalance');
}
