import type {
  CategorySpend,
  FinanceData,
  PeriodKey,
  PeriodSpending,
  Satang,
  SummaryCategory,
} from '../types/finance';
import { addMonths, formatPeriodKey, parsePeriodKey } from './date';
import { installmentSchedule } from './installment';
import { payPeriodForKey } from './period';
import { subscriptionCharges } from './subscription';

export type { CategorySpend, PeriodSpending, SummaryCategory };

/**
 * Computes spending by category for a pay period (SPEC §3 & §6).
 * BillPayments are intentionally excluded because subscription and installment charges are already counted
 * on their charge dates, preventing double-counting when credit card or SPayLater bills are paid.
 */
export function spendingByCategory(data: FinanceData, periodKey: PeriodKey): PeriodSpending {
  const period = payPeriodForKey(periodKey, data.settings.payDay);
  const byCategory = new Map<SummaryCategory, Satang>();
  let saved: Satang = 0;
  let unknown: Satang = 0;

  const addSpend = (category: SummaryCategory, amount: Satang) => {
    if (amount <= 0) return;
    byCategory.set(category, (byCategory.get(category) ?? 0) + amount);
  };

  for (const tx of data.transactions) {
    // Refunds/income do not offset spending categories in Phase 2 (SPEC §3).
    if (tx.direction !== 'out' || tx.amount <= 0) continue;
    if (tx.date < period.start || tx.date > period.end) continue;

    if (tx.category === 'savings') {
      // Savings are tracked separately as "เก็บ" rather than spending.
      saved += tx.amount;
      continue;
    }

    if (tx.category === 'unknown') {
      unknown += tx.amount;
    }
    addSpend(tx.category, tx.amount);
  }

  for (const sub of data.subscriptions) {
    for (const charge of subscriptionCharges(sub, period.start, period.end)) {
      addSpend('subscription', charge.amount);
    }
  }

  for (const inst of data.installments) {
    for (const charge of installmentSchedule(inst)) {
      if (charge.chargeDate >= period.start && charge.chargeDate <= period.end) {
        addSpend('installment', charge.amount);
      }
    }
  }

  let total: Satang = 0;
  for (const amount of byCategory.values()) {
    total += amount;
  }

  const categories: CategorySpend[] = Array.from(byCategory.entries())
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category, amount]) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    }));

  return {
    periodKey,
    total,
    saved,
    unknown,
    categories,
  };
}

/** Computes spending summaries across the last `n` pay periods ending at `periodKey` in chronological order (SPEC §3 & §6). */
export function spendingHistory(data: FinanceData, periodKey: PeriodKey, n = 6): PeriodSpending[] {
  if (n <= 0) return [];

  const { year, month } = parsePeriodKey(periodKey);
  const result: PeriodSpending[] = [];

  for (let i = n - 1; i >= 0; i--) {
    const ym = addMonths(year, month, -i);
    const key = formatPeriodKey(ym.year, ym.month);
    result.push(spendingByCategory(data, key));
  }

  return result;
}
