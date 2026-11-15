import { describe, expect, it } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import type { Installment } from '../types/finance';
import { installmentSchedule } from './index';

describe('installmentSchedule', () => {
  it('generates 10 monthly installments for AirPods with exact dates through the final charge', () => {
    const airpods = financeFixture.installments[0]!;
    const schedule = installmentSchedule(airpods);

    expect(schedule).toHaveLength(10);
    expect(schedule[0]).toEqual({ n: 1, chargeDate: '2026-09-01', amount: 138_193 });
    expect(schedule[2]).toEqual({ n: 3, chargeDate: '2026-11-01', amount: 138_193 });
    expect(schedule[9]).toEqual({ n: 10, chargeDate: '2027-06-01', amount: 138_193 });
    expect(schedule.map((c) => c.chargeDate)).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
      '2027-03-01',
      '2027-04-01',
      '2027-05-01',
      '2027-06-01',
    ]);
  });

  it('preserves original day 31 after passing through shorter months', () => {
    const inst: Installment = {
      id: 'inst-31',
      name: 'Phone',
      perInstallment: 100_000,
      count: 4,
      firstChargeDate: '2026-01-31',
      sourceId: 'src-spay',
      potId: null,
    };

    expect(installmentSchedule(inst)).toEqual([
      { n: 1, chargeDate: '2026-01-31', amount: 100_000 },
      { n: 2, chargeDate: '2026-02-28', amount: 100_000 },
      { n: 3, chargeDate: '2026-03-31', amount: 100_000 },
      { n: 4, chargeDate: '2026-04-30', amount: 100_000 },
    ]);
  });
});
