import type { FinanceData, PeriodKey, Pot, PotStatus, Satang } from '../types/finance';
import { billAmountForPot } from './bills';
import { addDays, addMonths, formatPeriodKey, nextPeriodKey, parsePeriodKey } from './date';
import { installmentSchedule } from './installment';
import { payPeriod, payPeriodForKey } from './period';
import { hasBillingCycle, statementWindowForKey } from './statement';
import { subscriptionCharges } from './subscription';

/**
 * Earliest pay period with at least one transaction or bill payment.
 * Installment and subscription start dates are intentionally excluded so history never unwinds infinitely.
 */
function findFirstDataPeriodKey(data: FinanceData): PeriodKey | null {
  const payDay = data.settings.payDay;
  let earliest: PeriodKey | null = null;

  const consider = (key: PeriodKey) => {
    if (earliest === null || key < earliest) earliest = key;
  };

  for (const tx of data.transactions) {
    consider(payPeriod(tx.date, payDay).key);
  }
  for (const payment of data.payments) {
    consider(payPeriod(payment.paidOn, payDay).key);
  }

  return earliest;
}

/**
 * Period where the rollover chain starts (carryIn = 0 there).
 * An explicit `settings.budgetStartPeriod` wins: imported history would otherwise start the chain months back
 * and push every old surplus/deficit into the current period. Without it, fall back to the first data period.
 */
function findRolloverStartKey(data: FinanceData): PeriodKey | null {
  return data.settings.budgetStartPeriod ?? findFirstDataPeriodKey(data);
}

function computeSinglePeriodStatus(
  pot: Pot,
  periodKey: PeriodKey,
  data: FinanceData,
  carryIn: Satang,
  paidKeys: ReadonlySet<string>,
): PotStatus {
  const payDay = data.settings.payDay;
  const period = payPeriodForKey(periodKey, payDay);
  const { year, month } = parsePeriodKey(periodKey);
  const sourceById = new Map(data.sources.map((s) => [s.id, s]));

  let reserved: Satang = 0;
  let spent: Satang = 0;

  // Bills belong to the pay period covering (dueDate - 1 day) so a "due by day 10" bill draws from the prior paycheck.
  const firstCandidate = addMonths(year, month, -2);
  const lastCandidate = addMonths(year, month, 2);

  for (const src of data.sources) {
    if (!hasBillingCycle(src)) continue;

    let cursor = firstCandidate;
    while (
      cursor.year < lastCandidate.year ||
      (cursor.year === lastCandidate.year && cursor.month <= lastCandidate.month)
    ) {
      const statementKey = formatPeriodKey(cursor.year, cursor.month);
      const win = statementWindowForKey(src, statementKey);
      const billPeriodKey = payPeriod(addDays(win.dueDate, -1), payDay).key;

      if (billPeriodKey === periodKey) {
        const potBill = billAmountForPot(src, statementKey, data, pot.id);
        if (potBill > 0) {
          if (paidKeys.has(`${src.id}\0${statementKey}`)) {
            spent += potBill;
          } else {
            reserved += potBill;
          }
        }
      }
      cursor = addMonths(cursor.year, cursor.month, 1);
    }
  }

  // Only non-billed (bank) transactions count directly toward spent; card/paylater transactions are counted via their bill.
  for (const tx of data.transactions) {
    if (tx.potId !== pot.id) continue;
    if (tx.date < period.start || tx.date > period.end) continue;
    const src = sourceById.get(tx.sourceId);
    if (src && hasBillingCycle(src)) continue;

    if (tx.direction === 'out') spent += tx.amount;
    else spent -= tx.amount;
  }

  // Defensive support for subscriptions or installments charged directly to a bank source.
  for (const sub of data.subscriptions) {
    if (sub.potId !== pot.id) continue;
    const src = sourceById.get(sub.sourceId);
    if (!src || hasBillingCycle(src)) continue;
    for (const charge of subscriptionCharges(sub, period.start, period.end)) {
      spent += charge.amount;
    }
  }

  for (const inst of data.installments) {
    if (inst.potId !== pot.id) continue;
    const src = sourceById.get(inst.sourceId);
    if (!src || hasBillingCycle(src)) continue;
    for (const charge of installmentSchedule(inst)) {
      if (charge.chargeDate >= period.start && charge.chargeDate <= period.end) {
        spent += charge.amount;
      }
    }
  }

  const budget = pot.perPeriod + carryIn;
  const left = budget - reserved - spent;

  return {
    carryIn,
    budget,
    reserved,
    spent,
    left,
    over: left < 0,
  };
}

/** Calculate budget, reserved bills, spent, and rollover left for `pot` in `periodKey`. */
export function potStatus(pot: Pot, periodKey: PeriodKey, data: FinanceData): PotStatus {
  const paidKeys = new Set(data.payments.map((p) => `${p.sourceId}\0${p.statementKey}`));
  const startKey = findRolloverStartKey(data);

  // Periods before the start still get their own spent/reserved/left (history display) but carry nothing forward.
  if (!pot.rollover || startKey === null || periodKey <= startKey) {
    return computeSinglePeriodStatus(pot, periodKey, data, 0, paidKeys);
  }

  // Roll forward period by period from the start period.
  let carryIn: Satang = 0;
  let cursor = startKey;
  while (cursor < periodKey) {
    const status = computeSinglePeriodStatus(pot, cursor, data, carryIn, paidKeys);
    carryIn = status.left;
    cursor = nextPeriodKey(cursor);
  }

  return computeSinglePeriodStatus(pot, periodKey, data, carryIn, paidKeys);
}
