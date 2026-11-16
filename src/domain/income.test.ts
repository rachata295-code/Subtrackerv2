import { describe, expect, it } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import type { FinanceData } from '../types/finance';
import { pendingIncomes } from './income';

describe('SPEC §5 C7: pendingIncomes', () => {
  it('SPEC §5 C7: shows day-24 recurring income on 2026-11-24 when not yet confirmed, and hides it after confirmation', () => {
    // On 2026-11-15, only day-10 is <= today; day-24 is still in the future.
    const onNov15 = pendingIncomes(financeFixture, '2026-11-15');
    expect(onNov15.some((p) => p.recurringIncomeId === 'inc-mom-24')).toBe(false);
    expect(onNov15).toEqual([
      {
        recurringIncomeId: 'inc-mom-10',
        name: 'เงินจากแม่',
        amount: 510_000,
        sourceId: 'src-bank',
        dueOn: '2026-11-10',
      },
    ]);

    // On 2026-11-24 (after day-10 was confirmed), day-24 appears because it is not confirmed yet.
    const withDay10Confirmed: FinanceData = {
      ...financeFixture,
      transactions: [
        ...financeFixture.transactions,
        {
          id: 'tx-mom-10',
          date: '2026-11-10',
          amount: 510_000,
          direction: 'in',
          sourceId: 'src-bank',
          potId: null,
          category: 'allowance',
          note: 'เงินจากแม่',
          createdAt: '2026-11-10T08:00:00.000Z',
          recurringIncomeId: 'inc-mom-10',
          incomeDueOn: '2026-11-10',
        },
      ],
    };

    const onNov24BeforeClick = pendingIncomes(withDay10Confirmed, '2026-11-24');
    expect(onNov24BeforeClick).toEqual([
      {
        recurringIncomeId: 'inc-mom-24',
        name: 'เงินจากแม่',
        amount: 510_000,
        sourceId: 'src-bank',
        dueOn: '2026-11-24',
      },
    ]);

    // After clicking confirm for 2026-11-24 (even if actual received date was edited to 2026-11-25), it disappears.
    const withDay24Confirmed: FinanceData = {
      ...withDay10Confirmed,
      transactions: [
        ...withDay10Confirmed.transactions,
        {
          id: 'tx-mom-24',
          date: '2026-11-25',
          amount: 510_000,
          direction: 'in',
          sourceId: 'src-bank',
          potId: null,
          category: 'allowance',
          note: 'เงินจากแม่',
          createdAt: '2026-11-25T09:00:00.000Z',
          recurringIncomeId: 'inc-mom-24',
          incomeDueOn: '2026-11-24',
        },
      ],
    };

    expect(pendingIncomes(withDay24Confirmed, '2026-11-25')).toEqual([]);
  });

  it('SPEC §5 C7: clamps dayOfMonth = 31 to the last day of a 30-day month (2026-11-30) and ignores inactive items', () => {
    const data: FinanceData = {
      ...financeFixture,
      recurringIncomes: [
        {
          id: 'inc-end-of-month',
          name: 'โบนัสรายเดือน',
          amount: 300_000,
          dayOfMonth: 31,
          sourceId: 'src-bank',
          active: true,
        },
        {
          id: 'inc-inactive',
          name: 'ทุนเก่า',
          amount: 100_000,
          dayOfMonth: 12,
          sourceId: 'src-bank',
          active: false,
        },
      ],
    };

    // On 2026-11-29, day 30 is not reached yet
    expect(pendingIncomes(data, '2026-11-29')).toEqual([]);

    // On 2026-11-30, dayOfMonth=31 clamps to 2026-11-30 and appears
    expect(pendingIncomes(data, '2026-11-30')).toEqual([
      {
        recurringIncomeId: 'inc-end-of-month',
        name: 'โบนัสรายเดือน',
        amount: 300_000,
        sourceId: 'src-bank',
        dueOn: '2026-11-30',
      },
    ]);
  });
});
