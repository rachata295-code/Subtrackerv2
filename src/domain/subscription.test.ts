import { describe, expect, it } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import type { Subscription } from '../types/finance';
import { subscriptionCharges } from './index';

describe('subscriptionCharges', () => {
  it('generates monthly fixture charges within a range', () => {
    const gemini = financeFixture.subscriptions.find((s) => s.id === 'sub-gemini')!;
    expect(subscriptionCharges(gemini, '2026-10-10', '2026-11-09')).toEqual([
      { date: '2026-10-25', amount: 27_900 },
    ]);
  });

  it('clamps billingDay 31 to the last day of 30-day months and February', () => {
    const endOfMonthSub: Subscription = {
      id: 'sub-31',
      name: 'End of month',
      amount: 10_000,
      frequency: 'monthly',
      billingDay: 31,
      billingMonth: null,
      sourceId: 'src-card',
      potId: 'pot-play',
      active: true,
    };

    expect(subscriptionCharges(endOfMonthSub, '2026-01-01', '2026-04-30')).toEqual([
      { date: '2026-01-31', amount: 10_000 },
      { date: '2026-02-28', amount: 10_000 },
      { date: '2026-03-31', amount: 10_000 },
      { date: '2026-04-30', amount: 10_000 },
    ]);
  });

  it('supports yearly subscriptions and clamps Feb 29 in non-leap years', () => {
    const yearlySub: Subscription = {
      id: 'sub-yearly',
      name: 'Domain',
      amount: 45_000,
      frequency: 'yearly',
      billingDay: 29,
      billingMonth: 2,
      sourceId: 'src-card',
      potId: 'pot-play',
      active: true,
    };

    expect(subscriptionCharges(yearlySub, '2024-01-01', '2026-12-31')).toEqual([
      { date: '2024-02-29', amount: 45_000 },
      { date: '2025-02-28', amount: 45_000 },
      { date: '2026-02-28', amount: 45_000 },
    ]);
  });

  it('returns no charges when subscription is inactive or range is inverted', () => {
    const inactive: Subscription = { ...financeFixture.subscriptions[0]!, active: false };
    expect(subscriptionCharges(inactive, '2026-01-01', '2026-12-31')).toEqual([]);
    expect(subscriptionCharges(financeFixture.subscriptions[0]!, '2026-12-01', '2026-11-01')).toEqual([]);
  });
});
