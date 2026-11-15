import { describe, expect, it } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import type { FinanceData } from '../types/finance';
import { billAmount, upcomingOutflows } from './index';

const card = financeFixture.sources.find((s) => s.kind === 'credit_card')!;
const spay = financeFixture.sources.find((s) => s.kind === 'paylater')!;

describe('billAmount', () => {
  it('computes 2026-11 credit card bill as 107700 and SPayLater bill as 138193', () => {
    expect(billAmount(card, '2026-11', financeFixture)).toBe(107_700);
    expect(billAmount(spay, '2026-11', financeFixture)).toBe(138_193);
  });

  it('includes out transactions and installments with potId=null, and excludes in transactions', () => {
    const data: FinanceData = {
      ...financeFixture,
      transactions: [
        ...financeFixture.transactions,
        {
          id: 'tx-card-extra',
          date: '2026-11-05',
          amount: 15_000,
          direction: 'out',
          sourceId: 'src-card',
          potId: 'pot-play',
          category: 'food',
          note: 'กาแฟ',
          createdAt: '2026-11-05T05:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        {
          id: 'tx-card-refund',
          date: '2026-11-06',
          amount: 5_000,
          direction: 'in',
          sourceId: 'src-card',
          potId: 'pot-play',
          category: 'other',
          note: 'เงินคืน',
          createdAt: '2026-11-06T05:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
      ],
      installments: [
        ...financeFixture.installments,
        {
          id: 'inst-separate',
          name: 'กล้อง',
          perInstallment: 50_000,
          count: 6,
          firstChargeDate: '2026-11-01',
          sourceId: 'src-spay',
          potId: null,
        },
      ],
    };

    expect(billAmount(card, '2026-11', data)).toBe(122_700);
    expect(billAmount(spay, '2026-11', data)).toBe(188_193);
  });
});

describe('upcomingOutflows', () => {
  it('returns bills (counted) and card charges (counted:false) sorted by date over 30 days', () => {
    const outflows = upcomingOutflows(financeFixture, '2026-11-15', 30);

    expect(outflows).toEqual([
      {
        date: '2026-11-24',
        dueBy: false,
        title: expect.any(String),
        amount: 107_700,
        sourceId: 'src-card',
        kind: 'bill',
        counted: true,
        statementKey: '2026-11',
      },
      {
        date: '2026-11-25',
        dueBy: false,
        title: 'Gemini + YouTube',
        amount: 27_900,
        sourceId: 'src-card',
        kind: 'charge',
        counted: false,
        statementKey: '2026-12',
      },
      {
        date: '2026-12-01',
        dueBy: false,
        title: 'Claude',
        amount: 69_900,
        sourceId: 'src-card',
        kind: 'charge',
        counted: false,
        statementKey: '2026-12',
      },
      {
        date: '2026-12-03',
        dueBy: false,
        title: 'iCloud',
        amount: 9_900,
        sourceId: 'src-card',
        kind: 'charge',
        counted: false,
        statementKey: '2026-12',
      },
      {
        date: '2026-12-10',
        dueBy: true,
        title: expect.any(String),
        amount: 138_193,
        sourceId: 'src-spay',
        kind: 'bill',
        counted: true,
        statementKey: '2026-11',
      },
    ]);

    const countedTotal = outflows.filter((o) => o.counted).reduce((sum, o) => sum + o.amount, 0);
    expect(countedTotal).toBe(245_893);
  });

  it('removes a bill after it is paid', () => {
    const afterCardPaid: FinanceData = {
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

    const outflows = upcomingOutflows(afterCardPaid, '2026-11-15', 30);
    expect(outflows.some((o) => o.kind === 'bill' && o.sourceId === 'src-card')).toBe(false);
    expect(outflows.filter((o) => o.counted).reduce((s, o) => s + o.amount, 0)).toBe(138_193);
  });

  it('keeps installments with potId=null in upcomingOutflows bills', () => {
    const data: FinanceData = {
      ...financeFixture,
      installments: [
        ...financeFixture.installments,
        {
          id: 'inst-separate',
          name: 'กล้อง',
          perInstallment: 50_000,
          count: 6,
          firstChargeDate: '2026-11-01',
          sourceId: 'src-spay',
          potId: null,
        },
      ],
    };

    const outflows = upcomingOutflows(data, '2026-11-15', 30);
    const spayBill = outflows.find((o) => o.kind === 'bill' && o.sourceId === 'src-spay');
    expect(spayBill?.amount).toBe(188_193);
  });
});
