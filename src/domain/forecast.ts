import type {
  FinanceData,
  Forecast,
  ForecastEvent,
  ForecastLow,
  ISODate,
  Satang,
} from '../types/finance';
import { expectedBalance } from './balance';
import { billAmount } from './bills';
import { addDays, addMonths, formatPeriodKey, parsePeriodKey } from './date';
import { recurringIncomeDueDates } from './income';
import { payPeriod } from './period';
import { potStatus } from './pots';
import { hasBillingCycle, statementWindowForKey } from './statement';

export type { Forecast, ForecastEvent, ForecastLow };

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
        // The whole unpaid bill leaves the bank, whether or not its charges sit inside a pot: pot "left" is only
        // budget minus reserved minus spent, so reserved bills never show up there and must be subtracted here.
        const fullBill = billAmount(src, statementKey, data);
        bills += fullBill;
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

  // Pot leftovers are deliberately NOT subtracted: "available" is cash after known commitments (real unpaid bills
  // and plans), i.e. what can be spent until the end of the period. `potsLeft` stays on the result for display only.
  const available: Satang = start + incoming - bills - plans;

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
