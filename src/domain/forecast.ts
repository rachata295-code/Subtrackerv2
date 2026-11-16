import type {
  FinanceData,
  Forecast,
  ForecastEvent,
  ForecastLow,
  ISODate,
  PaymentSource,
  PeriodKey,
  Satang,
} from '../types/finance';
import { expectedBalance } from './balance';
import { billAmount } from './bills';
import { addDays, addMonths, formatPeriodKey, parsePeriodKey } from './date';
import { recurringIncomeDueDates } from './income';
import { installmentSchedule } from './installment';
import { payPeriod } from './period';
import { potStatus } from './pots';
import { hasBillingCycle, statementWindowForKey } from './statement';
import { subscriptionCharges } from './subscription';

export type { Forecast, ForecastEvent, ForecastLow };

/**
 * Sum statement charges for `src` in `statementKey` that do NOT belong to any pot (`potId === null`).
 * Pot-assigned charges are already deducted via `potStatus.reserved` in `potsLeft`, so counting only
 * non-pot charges in `Forecast.bills` prevents double-subtracting bills like the ฿1,077 credit card bill (SPEC §5 C5).
 */
function nonPotBillAmount(
  src: PaymentSource,
  statementKey: PeriodKey,
  data: FinanceData,
  validPotIds: ReadonlySet<string>,
): Satang {
  if (!hasBillingCycle(src)) return 0;

  const window = statementWindowForKey(src, statementKey);
  let total: Satang = 0;

  const isOutsidePots = (potId: string | null) => potId === null || !validPotIds.has(potId);

  for (const tx of data.transactions) {
    if (tx.sourceId !== src.id || tx.direction !== 'out') continue;
    if (!isOutsidePots(tx.potId)) continue;
    if (tx.date >= window.start && tx.date <= window.end) {
      total += tx.amount;
    }
  }

  for (const sub of data.subscriptions) {
    if (sub.sourceId !== src.id) continue;
    if (!isOutsidePots(sub.potId)) continue;
    for (const charge of subscriptionCharges(sub, window.start, window.end)) {
      total += charge.amount;
    }
  }

  for (const inst of data.installments) {
    if (inst.sourceId !== src.id) continue;
    if (!isOutsidePots(inst.potId)) continue;
    for (const charge of installmentSchedule(inst)) {
      if (charge.chargeDate >= window.start && charge.chargeDate <= window.end) {
        total += charge.amount;
      }
    }
  }

  return total;
}

/**
 * Computes available cash, component breakdown, and daily running-balance timeline for the current pay period (SPEC §5 C5 & §6).
 */
export function forecast(data: FinanceData, sourceId: string, today: ISODate): Forecast {
  const payDay = data.settings.payDay;
  const period = payPeriod(today, payDay);
  const { year, month } = parsePeriodKey(period.key);

  const start: Satang = expectedBalance(sourceId, data) ?? 0;

  const confirmedIncomeKeys = new Set<string>();
  for (const tx of data.transactions) {
    if (tx.recurringIncomeId && tx.incomeDueOn) {
      confirmedIncomeKeys.add(`${tx.recurringIncomeId}\0${tx.incomeDueOn}`);
    }
  }

  const rawEvents: Omit<ForecastEvent, 'balance'>[] = [];

  // 1. Incoming: unconfirmed active RecurringIncomes for this bank due in [today, period.end].
  let incoming: Satang = 0;
  if (today <= period.end) {
    for (const inc of data.recurringIncomes) {
      if (!inc.active || inc.sourceId !== sourceId || inc.amount <= 0) continue;
      for (const dueOn of recurringIncomeDueDates(inc, today, period.end)) {
        if (!confirmedIncomeKeys.has(`${inc.id}\0${dueOn}`)) {
          incoming += inc.amount;
          rawEvents.push({
            date: dueOn,
            kind: 'income',
            direction: 'in',
            title: inc.name,
            amount: inc.amount,
          });
        }
      }
    }
  }

  // 2. Unpaid bills for this bank due in the current pay period (using the SPEC §4 dueDate - 1 rule).
  let bills: Satang = 0;
  const paidKeys = new Set(data.payments.map((p) => `${p.sourceId}\0${p.statementKey}`));
  const validPotIds = new Set(data.pots.map((p) => p.id));
  const firstCandidate = addMonths(year, month, -2);
  const lastCandidate = addMonths(year, month, 2);

  for (const src of data.sources) {
    if (!hasBillingCycle(src) || src.payFromSourceId !== sourceId) continue;

    let cursor = firstCandidate;
    while (
      cursor.year < lastCandidate.year ||
      (cursor.year === lastCandidate.year && cursor.month <= lastCandidate.month)
    ) {
      const statementKey = formatPeriodKey(cursor.year, cursor.month);
      const win = statementWindowForKey(src, statementKey);
      const billPeriodKey = payPeriod(addDays(win.dueDate, -1), payDay).key;

      if (
        billPeriodKey === period.key &&
        win.dueDate >= today &&
        !paidKeys.has(`${src.id}\0${statementKey}`)
      ) {
        const nonPotAmount = nonPotBillAmount(src, statementKey, data, validPotIds);
        bills += nonPotAmount;

        const fullBill = billAmount(src, statementKey, data);
        if (fullBill > 0) {
          rawEvents.push({
            date: win.dueDate,
            kind: 'bill',
            direction: 'out',
            title: `บิล ${src.name}`,
            amount: fullBill,
          });
        }
      }
      cursor = addMonths(cursor.year, cursor.month, 1);
    }
  }

  // 3. Uncompleted PlanItems for this bank in the current period.
  let plans: Satang = 0;
  for (const item of data.planItems) {
    if (item.periodKey !== period.key || item.sourceId !== sourceId) continue;
    if (item.doneTxId !== null || item.amount <= 0) continue;

    plans += item.amount;
    if (item.dueOn !== null) {
      rawEvents.push({
        date: item.dueOn,
        kind: 'plan',
        direction: 'out',
        title: item.name,
        amount: item.amount,
      });
    }
  }

  // 4. Remaining positive budget across all pots in the current period.
  let potsLeft: Satang = 0;
  for (const pot of data.pots) {
    const status = potStatus(pot, period.key, data);
    if (status.left > 0) {
      potsLeft += status.left;
    }
  }

  const available: Satang = start + incoming - bills - plans - potsLeft;

  // Sort timeline chronologically; on the same date, outflows ('out') run before inflows ('in') (worst-case first).
  rawEvents.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.direction !== b.direction) return a.direction === 'out' ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === 'bill' ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  let runningBalance: Satang = start;
  let low: ForecastLow | null = null;
  const timeline: ForecastEvent[] = rawEvents.map((ev) => {
    runningBalance += ev.direction === 'in' ? ev.amount : -ev.amount;
    if (low === null || runningBalance < low.balance) {
      low = { date: ev.date, balance: runningBalance };
    }
    return {
      ...ev,
      balance: runningBalance,
    };
  });

  return {
    start,
    incoming,
    bills,
    plans,
    potsLeft,
    available,
    timeline,
    low,
  };
}
