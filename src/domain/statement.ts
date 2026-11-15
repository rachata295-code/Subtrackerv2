import type { ISODate, PaymentSource, PeriodKey, StatementWindow } from '../types/finance';
import { addDays, addMonths, clampDay, formatISODate, formatPeriodKey, parseISODate, parsePeriodKey } from './date';

export function hasBillingCycle(src: PaymentSource): boolean {
  return src.kind !== 'bank' && src.dueDay !== null;
}

/** Resolve the billing window and dueDate for a specific statement closing key ('YYYY-MM'). */
export function statementWindowForKey(src: PaymentSource, statementKey: PeriodKey): StatementWindow {
  if (!hasBillingCycle(src) || src.dueDay === null) {
    throw new RangeError(`PaymentSource "${src.id}" does not have billing statements`);
  }

  const { year: closeYear, month: closeMonth } = parsePeriodKey(statementKey);

  let start: ISODate;
  let end: ISODate;

  if (src.statementCloseDay !== null) {
    const prev = addMonths(closeYear, closeMonth, -1);
    start = formatISODate(prev.year, prev.month, clampDay(prev.year, prev.month, src.statementCloseDay));
    const closeDate = formatISODate(closeYear, closeMonth, clampDay(closeYear, closeMonth, src.statementCloseDay));
    end = addDays(closeDate, -1);
  } else {
    // Null statementCloseDay (e.g. SPayLater) uses the full calendar month.
    start = formatISODate(closeYear, closeMonth, 1);
    end = formatISODate(closeYear, closeMonth, clampDay(closeYear, closeMonth, 31));
  }

  const dueYM = addMonths(closeYear, closeMonth, src.dueMonthOffset ?? 0);
  const dueDate = formatISODate(dueYM.year, dueYM.month, clampDay(dueYM.year, dueYM.month, src.dueDay));

  return { key: statementKey, start, end, dueDate };
}

/** Find the statement window and closing key ('YYYY-MM') that a charge on `chargeDate` falls into. */
export function statementFor(src: PaymentSource, chargeDate: ISODate): StatementWindow {
  if (!hasBillingCycle(src) || src.dueDay === null) {
    throw new RangeError(`PaymentSource "${src.id}" does not have billing statements`);
  }

  const { year, month, day } = parseISODate(chargeDate);

  if (src.statementCloseDay === null) {
    return statementWindowForKey(src, formatPeriodKey(year, month));
  }

  // Charges on or after closeDay belong to the next month's closing statement.
  const closeDayInMonth = clampDay(year, month, src.statementCloseDay);
  const closingYM = day < closeDayInMonth ? { year, month } : addMonths(year, month, 1);
  return statementWindowForKey(src, formatPeriodKey(closingYM.year, closingYM.month));
}
