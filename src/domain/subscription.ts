import type { ISODate, Subscription, SubscriptionCharge } from '../types/finance';
import { addMonths, clampDay, formatISODate, parseISODate } from './date';

/** List all active charge dates and amounts for `sub` within `[from, to]` inclusive. */
export function subscriptionCharges(sub: Subscription, from: ISODate, to: ISODate): SubscriptionCharge[] {
  if (!sub.active || from > to) return [];

  const start = parseISODate(from);
  const end = parseISODate(to);
  const charges: SubscriptionCharge[] = [];

  if (sub.frequency === 'monthly') {
    let cursor = { year: start.year, month: start.month };
    while (cursor.year < end.year || (cursor.year === end.year && cursor.month <= end.month)) {
      const date = formatISODate(cursor.year, cursor.month, clampDay(cursor.year, cursor.month, sub.billingDay));
      if (date >= from && date <= to) {
        charges.push({ date, amount: sub.amount });
      }
      cursor = addMonths(cursor.year, cursor.month, 1);
    }
    return charges;
  }

  if (sub.billingMonth === null) return [];

  for (let year = start.year; year <= end.year; year++) {
    const date = formatISODate(year, sub.billingMonth, clampDay(year, sub.billingMonth, sub.billingDay));
    if (date >= from && date <= to) {
      charges.push({ date, amount: sub.amount });
    }
  }

  return charges;
}
