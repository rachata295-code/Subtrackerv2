import type { FinanceData, ISODate, PendingIncome, RecurringIncome } from '../types/finance';
import { addMonths, clampDay, formatISODate, parseISODate } from './date';
import { payPeriod } from './period';

export type { PendingIncome };

/** List all due dates for a recurring income within `[from, to]` inclusive, clamping `dayOfMonth` to month end. */
export function recurringIncomeDueDates(inc: RecurringIncome, from: ISODate, to: ISODate): ISODate[] {
  if (!inc.active || inc.amount <= 0 || from > to) return [];

  const start = parseISODate(from);
  const end = parseISODate(to);
  const dates: ISODate[] = [];

  let cursor = { year: start.year, month: start.month };
  while (cursor.year < end.year || (cursor.year === end.year && cursor.month <= end.month)) {
    const dueOn = formatISODate(cursor.year, cursor.month, clampDay(cursor.year, cursor.month, inc.dayOfMonth));
    if (dueOn >= from && dueOn <= to) {
      dates.push(dueOn);
    }
    cursor = addMonths(cursor.year, cursor.month, 1);
  }

  return dates;
}

/**
 * Returns active recurring incomes due on or before `today` in the current period that have no confirmed transaction yet (SPEC §5 C7 & §6).
 */
export function pendingIncomes(data: FinanceData, today: ISODate): PendingIncome[] {
  const period = payPeriod(today, data.settings.payDay);
  if (today < period.start) return [];

  const effectiveEnd = today < period.end ? today : period.end;
  const confirmedKeys = new Set<string>();
  for (const tx of data.transactions) {
    if (tx.recurringIncomeId && tx.incomeDueOn) {
      confirmedKeys.add(`${tx.recurringIncomeId}\0${tx.incomeDueOn}`);
    }
  }

  const pending: PendingIncome[] = [];

  for (const inc of data.recurringIncomes) {
    if (!inc.active || inc.amount <= 0) continue;

    for (const dueOn of recurringIncomeDueDates(inc, period.start, effectiveEnd)) {
      if (!confirmedKeys.has(`${inc.id}\0${dueOn}`)) {
        pending.push({
          recurringIncomeId: inc.id,
          name: inc.name,
          amount: inc.amount,
          sourceId: inc.sourceId,
          dueOn,
        });
      }
    }
  }

  pending.sort((a, b) => {
    if (a.dueOn !== b.dueOn) return a.dueOn.localeCompare(b.dueOn);
    if (a.name !== b.name) return a.name.localeCompare(b.name);
    return a.recurringIncomeId.localeCompare(b.recurringIncomeId);
  });

  return pending;
}
