import type { FinanceData, ISODate, Outflow, PaymentSource, PeriodKey, Satang } from '../types/finance';
import { addDays, addMonths, formatPeriodKey, parseISODate } from './date';
import { installmentSchedule } from './installment';
import { hasBillingCycle, statementFor, statementWindowForKey } from './statement';
import { subscriptionCharges } from './subscription';

/** Sum charges falling inside `src`'s statement window, optionally filtered to a single pot. */
export function billAmountForPot(
  src: PaymentSource,
  statementKey: PeriodKey,
  data: FinanceData,
  potId?: string,
): Satang {
  if (!hasBillingCycle(src)) return 0;

  const window = statementWindowForKey(src, statementKey);
  let total = 0;

  for (const tx of data.transactions) {
    if (tx.sourceId !== src.id || tx.direction !== 'out') continue;
    if (potId !== undefined && tx.potId !== potId) continue;
    if (tx.date >= window.start && tx.date <= window.end) {
      total += tx.amount;
    }
  }

  for (const sub of data.subscriptions) {
    if (sub.sourceId !== src.id) continue;
    if (potId !== undefined && sub.potId !== potId) continue;
    for (const charge of subscriptionCharges(sub, window.start, window.end)) {
      total += charge.amount;
    }
  }

  for (const inst of data.installments) {
    if (inst.sourceId !== src.id) continue;
    if (potId !== undefined && inst.potId !== potId) continue;
    for (const charge of installmentSchedule(inst)) {
      if (charge.chargeDate >= window.start && charge.chargeDate <= window.end) {
        total += charge.amount;
      }
    }
  }

  return total;
}

/** Total statement bill for `src` in `statementKey` (in integer satang). */
export function billAmount(src: PaymentSource, statementKey: PeriodKey, data: FinanceData): Satang {
  return billAmountForPot(src, statementKey, data);
}

/** List upcoming unpaid bills (counted) and informational card charges (counted: false) over `days` from `today`. */
export function upcomingOutflows(data: FinanceData, today: ISODate, days = 30): Outflow[] {
  if (days < 0) return [];

  const endDate = addDays(today, days);
  const startYM = parseISODate(today);
  const endYM = parseISODate(endDate);
  const sourceById = new Map(data.sources.map((s) => [s.id, s]));
  const paidKeys = new Set(data.payments.map((p) => `${p.sourceId}\0${p.statementKey}`));
  const outflows: Outflow[] = [];

  // Enumerate candidate statement keys wide enough to capture any dueMonthOffset (0 or 1).
  const firstCandidate = addMonths(startYM.year, startYM.month, -2);
  const lastCandidate = addMonths(endYM.year, endYM.month, 2);

  for (const src of data.sources) {
    if (!hasBillingCycle(src)) continue;

    let cursor = firstCandidate;
    while (
      cursor.year < lastCandidate.year ||
      (cursor.year === lastCandidate.year && cursor.month <= lastCandidate.month)
    ) {
      const statementKey = formatPeriodKey(cursor.year, cursor.month);
      const win = statementWindowForKey(src, statementKey);
      if (win.dueDate >= today && win.dueDate <= endDate && !paidKeys.has(`${src.id}\0${statementKey}`)) {
        const amount = billAmount(src, statementKey, data);
        if (amount > 0) {
          outflows.push({
            date: win.dueDate,
            dueBy: src.kind === 'paylater',
            title: `บิล ${src.name}`,
            amount,
            sourceId: src.id,
            kind: 'bill',
            counted: true,
            statementKey,
          });
        }
      }
      cursor = addMonths(cursor.year, cursor.month, 1);
    }
  }

  // Subscription charges on card/paylater are informational (counted: false) because the bill counts them.
  // Direct bank subscriptions have no bill, so they are counted directly.
  for (const sub of data.subscriptions) {
    const src = sourceById.get(sub.sourceId);
    if (!src) continue;
    const billedSource = hasBillingCycle(src);

    for (const charge of subscriptionCharges(sub, today, endDate)) {
      outflows.push({
        date: charge.date,
        dueBy: false,
        title: sub.name,
        amount: charge.amount,
        sourceId: sub.sourceId,
        kind: 'charge',
        counted: !billedSource,
        ...(billedSource ? { statementKey: statementFor(src, charge.date).key } : {}),
      });
    }
  }

  outflows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.kind !== b.kind) return a.kind === 'bill' ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return outflows;
}
