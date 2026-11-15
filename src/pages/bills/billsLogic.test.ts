import { describe, expect, it } from 'vitest';
import { financeFixture } from '../../fixtures/finance';
import type { FinanceData } from '../../types/finance';
import { computeBillsCycleSummary, getCycleCharges, getSourceBillCycles } from './billsLogic';

describe('computeBillsCycleSummary', () => {
  it('computes fixture channel totals (card 1,077.00, SPayLater 1,381.93) and total 2,458.93 without double counting', () => {
    const summary = computeBillsCycleSummary(financeFixture, '2026-11-15');

    expect(summary.channels).toHaveLength(2);
    expect(summary.channels[0]).toMatchObject({
      source: { id: 'src-card', name: 'บัตรเครดิต' },
      statementKey: '2026-11',
      dueDate: '2026-11-24',
      dueBy: false,
      amountSatang: 107_700,
      paid: false,
    });
    expect(summary.channels[1]).toMatchObject({
      source: { id: 'src-spay', name: 'SPayLater' },
      statementKey: '2026-11',
      dueDate: '2026-12-10',
      dueBy: true,
      amountSatang: 138_193,
      paid: false,
    });

    expect(summary.totalSatang).toBe(245_893);
    expect(summary.paidSatang).toBe(0);
    expect(summary.unpaidSatang).toBe(245_893);
  });

  it('uses billAmount for card/paylater so subscriptions on a card are never counted twice', () => {
    const data: FinanceData = {
      ...structuredClone(financeFixture),
      subscriptions: [
        ...structuredClone(financeFixture.subscriptions),
        // Nov 5 falls inside the 2026-11 card statement (Oct 10 - Nov 9) -> counted once inside billAmount.
        {
          id: 'sub-in-cycle',
          name: 'Notion',
          amount: 35_000,
          frequency: 'monthly',
          billingDay: 5,
          billingMonth: null,
          sourceId: 'src-card',
          potId: 'pot-play',
          active: true,
        },
        // Nov 15 yearly charge falls into 2026-12 statement -> must NOT leak into the 2026-11 card bill total.
        {
          id: 'sub-next-cycle',
          name: 'Spotify',
          amount: 12_900,
          frequency: 'yearly',
          billingDay: 15,
          billingMonth: 11,
          sourceId: 'src-card',
          potId: 'pot-play',
          active: true,
        },
        // Inactive subscription must be ignored.
        {
          id: 'sub-paused',
          name: 'Paused',
          amount: 50_000,
          frequency: 'monthly',
          billingDay: 2,
          billingMonth: null,
          sourceId: 'src-card',
          potId: 'pot-play',
          active: false,
        },
      ],
    };

    const summary = computeBillsCycleSummary(data, '2026-11-15');
    const card = summary.channels.find((c) => c.source.id === 'src-card')!;
    expect(card.amountSatang).toBe(107_700 + 35_000);
    expect(summary.totalSatang).toBe(107_700 + 35_000 + 138_193);
  });

  it('tracks paid vs unpaid totals when a channel bill has been paid', () => {
    const data: FinanceData = {
      ...structuredClone(financeFixture),
      payments: [
        ...financeFixture.payments,
        {
          id: 'pay-nov-card',
          sourceId: 'src-card',
          statementKey: '2026-11',
          amount: 107_700,
          paidOn: '2026-11-15',
          createdAt: '2026-11-15T09:00:00.000Z',
        },
      ],
    };

    const summary = computeBillsCycleSummary(data, '2026-11-15');
    const card = summary.channels.find((c) => c.source.id === 'src-card')!;
    const spay = summary.channels.find((c) => c.source.id === 'src-spay')!;

    expect(card.paid).toBe(true);
    expect(spay.paid).toBe(false);
    expect(summary.totalSatang).toBe(245_893);
    expect(summary.paidSatang).toBe(107_700);
    expect(summary.unpaidSatang).toBe(138_193);
  });

  it('excludes archived billing sources and includes direct bank subscriptions only when non-zero', () => {
    const data: FinanceData = {
      ...structuredClone(financeFixture),
      sources: [
        ...financeFixture.sources,
        {
          id: 'src-old-card',
          name: 'บัตรเก่า',
          kind: 'credit_card',
          hue: 'lilac',
          archived: true,
          statementCloseDay: 10,
          dueDay: 24,
          dueMonthOffset: 0,
          payFromSourceId: 'src-bank',
        },
      ],
      subscriptions: [
        ...financeFixture.subscriptions,
        {
          id: 'sub-bank',
          name: 'ค่าเน็ตบ้าน',
          amount: 59_900,
          frequency: 'monthly',
          billingDay: 15,
          billingMonth: null,
          sourceId: 'src-bank',
          potId: 'pot-essential',
          active: true,
        },
      ],
    };

    const summary = computeBillsCycleSummary(data, '2026-11-15');
    expect(summary.channels.map((c) => c.source.id)).toEqual(['src-card', 'src-spay', 'src-bank']);
    const bank = summary.channels.find((c) => c.source.id === 'src-bank')!;
    expect(bank.amountSatang).toBe(59_900);
    expect(summary.totalSatang).toBe(245_893 + 59_900);
  });
});

describe('getCycleCharges', () => {
  it('attaches sourceId and potId to cycle charges for desktop single-row display', () => {
    const card = financeFixture.sources.find((s) => s.id === 'src-card')!;
    const { current } = getSourceBillCycles(card, '2026-11-15', 0);
    const charges = getCycleCharges(card, current, financeFixture);
    expect(charges).toHaveLength(3);
    expect(charges[0]).toMatchObject({
      sourceId: 'src-card',
      potId: 'pot-play',
    });
  });
});
