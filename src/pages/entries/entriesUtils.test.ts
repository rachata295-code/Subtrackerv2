import { describe, expect, it } from 'vitest';
import type { PayPeriod, Transaction } from '../../types/finance';
import {
  filterTransactions,
  getPeriodOptions,
  groupTransactionsByDay,
  isValidISODate,
} from './entriesUtils';

const PERIOD: PayPeriod = {
  key: '2026-11',
  start: '2026-11-10',
  end: '2026-12-09',
};

const TXS: Transaction[] = [
  {
    id: 'tx-before',
    date: '2026-11-09',
    amount: 5_000,
    direction: 'out',
    sourceId: 'src-bank',
    potId: 'pot-play',
    category: 'food',
    note: 'ก่อนรอบ',
    createdAt: '2026-11-09T05:00:00.000Z',
    recurringIncomeId: null,
    incomeDueOn: null,
  },
  {
    id: 'tx-1',
    date: '2026-11-11',
    amount: 22_000,
    direction: 'out',
    sourceId: 'src-bank',
    potId: 'pot-play',
    category: 'entertainment',
    note: 'หนัง',
    createdAt: '2026-11-11T05:00:00.000Z',
    recurringIncomeId: null,
    incomeDueOn: null,
  },
  {
    id: 'tx-2',
    date: '2026-11-12',
    amount: 8_500,
    direction: 'out',
    sourceId: 'src-bank',
    potId: 'pot-essential',
    category: 'food',
    note: 'ข้าว',
    createdAt: '2026-11-12T05:00:00.000Z',
    recurringIncomeId: null,
    incomeDueOn: null,
  },
  {
    id: 'tx-3',
    date: '2026-11-12',
    amount: 6_500,
    direction: 'out',
    sourceId: 'src-card',
    potId: 'pot-play',
    category: 'food',
    note: 'กาแฟ',
    createdAt: '2026-11-12T06:00:00.000Z',
    recurringIncomeId: null,
    incomeDueOn: null,
  },
  {
    id: 'tx-4',
    date: '2026-11-13',
    amount: 50_000,
    direction: 'in',
    sourceId: 'src-bank',
    potId: null,
    category: 'other',
    note: 'โอนคืน',
    createdAt: '2026-11-13T05:00:00.000Z',
    recurringIncomeId: null,
    incomeDueOn: null,
  },
  {
    id: 'tx-after',
    date: '2026-12-10',
    amount: 1_000,
    direction: 'out',
    sourceId: 'src-bank',
    potId: 'pot-play',
    category: 'other',
    note: 'รอบหน้า',
    createdAt: '2026-12-10T05:00:00.000Z',
    recurringIncomeId: null,
    incomeDueOn: null,
  },
];

describe('entriesUtils', () => {
  it('filters transactions by period, sourceFilter, and potFilter', () => {
    expect(filterTransactions(TXS, PERIOD, 'all', 'all').map((t) => t.id)).toEqual([
      'tx-1',
      'tx-2',
      'tx-3',
      'tx-4',
    ]);

    expect(filterTransactions(TXS, PERIOD, 'src-card', 'all').map((t) => t.id)).toEqual(['tx-3']);
    expect(filterTransactions(TXS, PERIOD, 'all', 'pot-play').map((t) => t.id)).toEqual(['tx-1', 'tx-3']);
    expect(filterTransactions(TXS, PERIOD, 'src-bank', 'pot-essential').map((t) => t.id)).toEqual(['tx-2']);
    expect(filterTransactions(TXS, PERIOD, 'src-card', 'pot-essential')).toEqual([]);
  });

  it('groups filtered transactions by day descending with latest-first intra-day order and daily totals', () => {
    const groups = groupTransactionsByDay(TXS, PERIOD, 'all', 'pot-play');
    expect(groups.map((g) => g.date)).toEqual(['2026-11-12', '2026-11-11']);
    expect(groups[0].transactions.map((t) => t.id)).toEqual(['tx-3']);
    expect(groups[0].displayBaht).toBe(65);
    expect(groups[0].displayKind).toBe('spend');
    expect(groups[1].displayBaht).toBe(220);
  });

  it('computes net income/spend displayKind accurately per day', () => {
    const mixed: Transaction[] = [
      {
        id: 'm1',
        date: '2026-11-14',
        amount: 30_000,
        direction: 'out',
        sourceId: 'src-bank',
        potId: 'pot-play',
        category: 'food',
        note: 'อาหาร',
        createdAt: '2026-11-14T05:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
      {
        id: 'm2',
        date: '2026-11-14',
        amount: 10_000,
        direction: 'in',
        sourceId: 'src-bank',
        potId: null,
        category: 'other',
        note: 'คืนเงิน',
        createdAt: '2026-11-14T06:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
    ];
    const groups = groupTransactionsByDay(mixed, PERIOD, 'all', 'all');
    expect(groups).toHaveLength(1);
    expect(groups[0].displayBaht).toBe(-200);
    expect(groups[0].displayKind).toBe('spend');
  });

  it('returns 3 pay period options in reverse chronological order', () => {
    const opts = getPeriodOptions('2026-11-15', 10);
    expect(opts.map((o) => [o.offset, o.label, o.period.key])).toEqual([
      ['0', 'รอบนี้', '2026-11'],
      ['1', 'รอบก่อน', '2026-10'],
      ['2', '2 รอบก่อน', '2026-09'],
    ]);
  });

  it('validates ISO calendar dates strictly', () => {
    expect(isValidISODate('2026-11-15')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('15-11-2026')).toBe(false);
  });
});
