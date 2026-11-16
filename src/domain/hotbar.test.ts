import { describe, expect, it } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import type { FinanceData } from '../types/finance';
import { hotbarItems } from './hotbar';

describe('SPEC §4 B3: hotbarItems', () => {
  it('SPEC §4 B3: groups out transactions within 60 days with count >= 2 and ranks ข้าวมันไก่ 45 before ชานม 85', () => {
    const items = hotbarItems(financeFixture, '2026-11-15');

    expect(items).toEqual([
      {
        note: 'ข้าวมันไก่',
        amount: 4_500,
        category: 'food',
        sourceId: 'src-bank',
        potId: 'pot-essential',
        count: 3,
        lastDate: '2026-11-08',
      },
      {
        note: 'ชานม',
        amount: 8_500,
        category: 'food',
        sourceId: 'src-bank',
        potId: 'pot-essential',
        count: 2,
        lastDate: '2026-11-06',
      },
    ]);
  });

  it('SPEC §4 B3: normalizes note whitespace and case when grouping, breaks ties by most recent date, and respects 60-day window and limit', () => {
    const data: FinanceData = {
      ...financeFixture,
      transactions: [
        ...financeFixture.transactions,
        // Same item with extra whitespace/case -> merges into Grab 60 (count = 3, lastDate = 2026-11-14)
        {
          id: 'tx-grab-1',
          date: '2026-11-01',
          amount: 6_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'transport',
          note: '  Grab  Bike ',
          createdAt: '2026-11-01T08:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        {
          id: 'tx-grab-2',
          date: '2026-11-10',
          amount: 6_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'transport',
          note: 'grab bike',
          createdAt: '2026-11-10T08:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        {
          id: 'tx-grab-3',
          date: '2026-11-14',
          amount: 6_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'transport',
          note: 'Grab Bike',
          createdAt: '2026-11-14T08:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        // Older than 60 days before 2026-11-15 (< 2026-09-16) -> ignored
        {
          id: 'tx-old-1',
          date: '2026-09-10',
          amount: 5_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'food',
          note: 'ก๋วยเตี๋ยว',
          createdAt: '2026-09-10T08:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        {
          id: 'tx-old-2',
          date: '2026-09-15',
          amount: 5_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'food',
          note: 'ก๋วยเตี๋ยว',
          createdAt: '2026-09-15T08:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        // Repeated income (direction = 'in') -> never appears in hotbar
        {
          id: 'tx-in-1',
          date: '2026-11-01',
          amount: 50_000,
          direction: 'in',
          sourceId: 'src-bank',
          potId: null,
          category: 'parttime',
          note: 'สอนพิเศษ',
          createdAt: '2026-11-01T08:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        {
          id: 'tx-in-2',
          date: '2026-11-08',
          amount: 50_000,
          direction: 'in',
          sourceId: 'src-bank',
          potId: null,
          category: 'parttime',
          note: 'สอนพิเศษ',
          createdAt: '2026-11-08T08:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
      ],
    };

    const all = hotbarItems(data, '2026-11-15');
    // Both Grab Bike and ข้าวมันไก่ have count = 3, but Grab Bike has lastDate 2026-11-14 > 2026-11-08
    expect(all.map((i) => i.note)).toEqual(['Grab Bike', 'ข้าวมันไก่', 'ชานม']);

    // Respects limit parameter
    expect(hotbarItems(data, '2026-11-15', 2)).toHaveLength(2);
    expect(hotbarItems(data, '2026-11-15', 0)).toEqual([]);
  });
});
