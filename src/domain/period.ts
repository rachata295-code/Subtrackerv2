import type { ISODate, PayPeriod, PeriodKey } from '../types/finance';
import { addDays, addMonths, clampDay, formatISODate, formatPeriodKey, parseISODate, parsePeriodKey } from './date';

/** Compute start and end dates for a given pay period key and payDay. */
export function payPeriodForKey(key: PeriodKey, payDay: number): PayPeriod {
  const { year, month } = parsePeriodKey(key);
  const startDay = clampDay(year, month, payDay);
  const start = formatISODate(year, month, startDay);

  // End is always the day before the next period starts, keeping consecutive periods contiguous.
  const next = addMonths(year, month, 1);
  const nextStart = formatISODate(next.year, next.month, clampDay(next.year, next.month, payDay));
  const end = addDays(nextStart, -1);

  return { key, start, end };
}

/** Determine the pay period containing `date` for a monthly `payDay` (1-31). */
export function payPeriod(date: ISODate, payDay: number): PayPeriod {
  const { year, month, day } = parseISODate(date);
  const currentMonthStartDay = clampDay(year, month, payDay);

  if (day >= currentMonthStartDay) {
    return payPeriodForKey(formatPeriodKey(year, month), payDay);
  }

  const prev = addMonths(year, month, -1);
  return payPeriodForKey(formatPeriodKey(prev.year, prev.month), payDay);
}
