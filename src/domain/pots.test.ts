import { describe, expect, it } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import type { FinanceData } from '../types/finance';
import { potStatus } from './index';

const playPot = financeFixture.pots.find((p) => p.id === 'pot-play')!;
const essentialPot = financeFixture.pots.find((p) => p.id === 'pot-essential')!;

describe('potStatus', () => {
  it('computes play pot status for 2026-11 matching SPEC §4 real numbers', () => {
    expect(potStatus(playPot, '2026-11', financeFixture)).toEqual({
      carryIn: 54_100,
      budget: 354_100,
      reserved: 245_893,
      spent: 42_000,
      left: 66_207,
      over: false,
    });
  });

  it('moves reserved to spent without changing left when the credit card bill is paid', () => {
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
        },
      ],
    };

    expect(potStatus(playPot, '2026-11', afterCardPaid)).toEqual({
      carryIn: 54_100,
      budget: 354_100,
      reserved: 138_193,
      spent: 149_700,
      left: 66_207,
      over: false,
    });
  });

  it('sets over=true when left < 0 and carries the negative balance into the next period', () => {
    const overspent: FinanceData = {
      ...financeFixture,
      transactions: [
        ...financeFixture.transactions,
        {
          id: 'tx-nov-overspend',
          date: '2026-11-20',
          amount: 100_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-play',
          category: 'shopping',
          note: 'ช้อปเกินงบ',
        },
      ],
    };

    const nov = potStatus(playPot, '2026-11', overspent);
    expect(nov).toEqual({
      carryIn: 54_100,
      budget: 354_100,
      reserved: 245_893,
      spent: 142_000,
      left: -33_793,
      over: true,
    });

    const dec = potStatus(playPot, '2026-12', overspent);
    expect(dec.carryIn).toBe(-33_793);
    expect(dec.budget).toBe(300_000 - 33_793);
  });

  it('excludes installments with potId=null from pot reserved and spent', () => {
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

    expect(potStatus(playPot, '2026-11', data)).toEqual({
      carryIn: 54_100,
      budget: 354_100,
      reserved: 245_893,
      spent: 42_000,
      left: 66_207,
      over: false,
    });
  });

  it('does not roll over when pot.rollover is false', () => {
    const dec = potStatus(essentialPot, '2026-11', financeFixture);
    expect(dec.carryIn).toBe(0);
    expect(dec.budget).toBe(720_000);
  });

  it('uses carryIn=0 before the first period with a transaction or bill_payment (ignoring installment/subscription start dates)', () => {
    // Fixture first tx/payment is in 2026-10, while AirPods starts 2026-09-01.
    // Querying 2026-09 must not carry backwards before 2026-10.
    const sep = potStatus(playPot, '2026-09', financeFixture);
    expect(sep.carryIn).toBe(0);

    // Even with subscriptions/installments present, if there are no transactions or payments,
    // carryIn stays 0 for any period.
    const noHistory: FinanceData = {
      ...financeFixture,
      transactions: [],
      payments: [],
    };
    expect(potStatus(playPot, '2026-11', noHistory).carryIn).toBe(0);
  });
});
