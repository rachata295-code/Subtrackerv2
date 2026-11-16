import { describe, expect, it } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import type { FinanceData } from '../types/finance';
import { spendingByCategory, spendingHistory } from './spending';

describe('SPEC §3: spendingByCategory & spendingHistory', () => {
  it('SPEC §3: computes hand-verified category breakdown for 2026-11 fixture without double-counting subscriptions or bill payments', () => {
    // 2026-11 pay period is 2026-11-10 .. 2026-12-09:
    // - installment: AirPods charge on 2026-12-01 = 138,193
    // - subscription: Gemini (2026-11-25: 27,900) + Claude (2026-12-01: 69,900) + iCloud (2026-12-03: 9,900) = 107,700
    // - entertainment: movie (22,000) + game (11,500) = 33,500
    // - food: milk tea on 2026-11-12 = 8,500
    // Total = 138,193 + 107,700 + 33,500 + 8,500 = 287,893 satang
    const summary = spendingByCategory(financeFixture, '2026-11');

    expect(summary.periodKey).toBe('2026-11');
    expect(summary.total).toBe(287_893);
    expect(summary.saved).toBe(0);
    expect(summary.unknown).toBe(0);

    expect(summary.categories.map((c) => ({ category: c.category, amount: c.amount }))).toEqual([
      { category: 'installment', amount: 138_193 },
      { category: 'subscription', amount: 107_700 },
      { category: 'entertainment', amount: 33_500 },
      { category: 'food', amount: 8_500 },
    ]);

    const pctSum = summary.categories.reduce((sum, c) => sum + c.percent, 0);
    expect(pctSum).toBeCloseTo(100, 5);
  });

  it('SPEC §3: never double-counts subscriptions when a credit card bill payment is recorded', () => {
    const withCardBillPaid: FinanceData = {
      ...financeFixture,
      payments: [
        ...financeFixture.payments,
        {
          id: 'pay-nov-card',
          sourceId: 'src-card',
          statementKey: '2026-11',
          amount: 107_700,
          paidOn: '2026-11-24',
          createdAt: '2026-11-24T09:00:00.000Z',
        },
      ],
    };

    const summary = spendingByCategory(withCardBillPaid, '2026-11');
    const subCat = summary.categories.find((c) => c.category === 'subscription');
    expect(subCat?.amount).toBe(107_700);
    expect(summary.total).toBe(287_893);
  });

  it('SPEC §3: separates savings into saved (excluded from total/categories), counts unknown (out), and ignores direction="in"', () => {
    const data: FinanceData = {
      ...financeFixture,
      transactions: [
        ...financeFixture.transactions,
        {
          id: 'tx-nov-save',
          date: '2026-11-28',
          amount: 200_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: null,
          category: 'savings',
          note: 'เก็บรายเดือน',
          createdAt: '2026-11-28T10:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        {
          id: 'tx-nov-unknown-out',
          date: '2026-11-15',
          amount: 13_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: null,
          category: 'unknown',
          note: 'ส่วนต่างเช็กยอด',
          createdAt: '2026-11-15T10:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        {
          id: 'tx-nov-income-in',
          date: '2026-11-16',
          amount: 50_000,
          direction: 'in',
          sourceId: 'src-bank',
          potId: null,
          category: 'parttime',
          note: 'พาร์ทไทม์',
          createdAt: '2026-11-16T10:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        {
          id: 'tx-nov-unknown-in',
          date: '2026-11-17',
          amount: 20_000,
          direction: 'in',
          sourceId: 'src-bank',
          potId: null,
          category: 'unknown',
          note: 'เงินเกินจากเช็กยอด',
          createdAt: '2026-11-17T10:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
      ],
    };

    const summary = spendingByCategory(data, '2026-11');
    expect(summary.saved).toBe(200_000);
    expect(summary.unknown).toBe(13_000);
    expect(summary.total).toBe(287_893 + 13_000);
    expect(summary.categories.some((c) => c.category === 'savings')).toBe(false);
    expect(summary.categories.find((c) => c.category === 'unknown')?.amount).toBe(13_000);
  });

  it('SPEC §3: spendingHistory returns the last n pay periods in chronological order ending at periodKey', () => {
    const history = spendingHistory(financeFixture, '2026-11', 6);
    expect(history.map((h) => h.periodKey)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(history[5]).toEqual(spendingByCategory(financeFixture, '2026-11'));
    expect(history[4]).toEqual(spendingByCategory(financeFixture, '2026-10'));
    expect(spendingHistory(financeFixture, '2026-11', 0)).toEqual([]);
  });
});
