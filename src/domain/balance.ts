import type { BalanceCheck, FinanceData, ISODate, Satang } from '../types/finance';

function compareTimestamps(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
    return ta - tb;
  }
  return a.localeCompare(b);
}

function isAfterReferenceCheck(itemDate: ISODate, itemCreatedAt: string, check: BalanceCheck): boolean {
  if (itemDate > check.checkedOn) return true;
  if (itemDate < check.checkedOn) return false;
  // Same calendar day as the check: only activity recorded strictly after the check alters the balance.
  return compareTimestamps(itemCreatedAt, check.createdAt) > 0;
}

/**
 * Computes the expected bank account balance from the latest BalanceCheck and subsequent activity (SPEC §5 C2 & §6).
 * Returns null if the source is not a bank account or has no reference BalanceCheck yet.
 */
export function expectedBalance(sourceId: string, data: FinanceData): Satang | null {
  const source = data.sources.find((s) => s.id === sourceId);
  if (source && source.kind !== 'bank') return null;

  const checks = data.balanceChecks
    .filter((c) => c.sourceId === sourceId)
    .sort((a, b) => {
      if (b.checkedOn !== a.checkedOn) return b.checkedOn.localeCompare(a.checkedOn);
      return compareTimestamps(b.createdAt, a.createdAt);
    });

  const latestCheck = checks[0];
  if (!latestCheck) return null;

  let balance: Satang = latestCheck.actual;

  for (const tx of data.transactions) {
    if (tx.sourceId !== sourceId) continue;
    // The adjustment transaction created for this check is already baked into `latestCheck.actual`.
    if (latestCheck.adjustmentTxId !== null && tx.id === latestCheck.adjustmentTxId) continue;
    if (!isAfterReferenceCheck(tx.date, tx.createdAt, latestCheck)) continue;

    if (tx.direction === 'in') {
      balance += tx.amount;
    } else {
      balance -= tx.amount;
    }
  }

  const sourceById = new Map(data.sources.map((s) => [s.id, s]));
  for (const payment of data.payments) {
    const billedSource = sourceById.get(payment.sourceId);
    if (!billedSource || billedSource.payFromSourceId !== sourceId) continue;
    if (!isAfterReferenceCheck(payment.paidOn, payment.createdAt, latestCheck)) continue;

    balance -= payment.amount;
  }

  return balance;
}
