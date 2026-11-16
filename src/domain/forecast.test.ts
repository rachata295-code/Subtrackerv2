import { describe, expect, it } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import type { FinanceData } from '../types/finance';
import { forecast } from './forecast';
import { potStatus } from './pots';

describe('SPEC §5 C5: forecast', () => {
  it('SPEC §5 C5: does NOT double-subtract the 1,077 credit card bill in both bills and potsLeft', () => {
    const playPot = financeFixture.pots.find((p) => p.id === 'pot-play')!;
    const essentialPot = financeFixture.pots.find((p) => p.id === 'pot-essential')!;

    // Play pot already reserves 1,077 (card) + 1,381.93 (SPayLater) = 2,458.93 -> left = 66,207
    expect(potStatus(playPot, '2026-11', financeFixture).reserved).toBe(245_893);
    expect(potStatus(playPot, '2026-11', financeFixture).left).toBe(66_207);
    expect(potStatus(essentialPot, '2026-11', financeFixture).left).toBe(720_000);

    const result = forecast(financeFixture, 'src-bank', '2026-11-15');

    // start = 468,000; incoming (24 Nov) = 510,000; bills (potId=null only) = 0; plans = 350,000; potsLeft = 786,207
    expect(result.start).toBe(468_000);
    expect(result.incoming).toBe(510_000);
    expect(result.bills).toBe(0);
    expect(result.plans).toBe(350_000);
    expect(result.potsLeft).toBe(786_207);
    expect(result.available).toBe(468_000 + 510_000 - 0 - 350_000 - 786_207);
    expect(result.available).toBe(-158_207);
  });

  it('SPEC §5 C5: subtracts installments with potId = null in bills without changing potsLeft', () => {
    const withSeparateInstallment: FinanceData = {
      ...financeFixture,
      installments: [
        ...financeFixture.installments,
        {
          id: 'inst-camera-separate',
          name: 'ผ่อนกล้องแยก',
          perInstallment: 50_000,
          count: 6,
          firstChargeDate: '2026-11-01',
          sourceId: 'src-spay', // paid from src-bank
          potId: null,
        },
      ],
    };

    const result = forecast(withSeparateInstallment, 'src-bank', '2026-11-15');
    expect(result.bills).toBe(50_000);
    expect(result.potsLeft).toBe(786_207);
    expect(result.available).toBe(468_000 + 510_000 - 50_000 - 350_000 - 786_207);
  });

  it('SPEC §5 C5: does not count uncertain/future parttime income in forecast incoming, only confirmed recurring incomes', () => {
    const withFutureParttime: FinanceData = {
      ...financeFixture,
      // Even if a future 'parttime' tx exists or past parttime exists, incoming only counts RecurringIncome
      transactions: [
        ...financeFixture.transactions,
        {
          id: 'tx-past-parttime',
          date: '2026-11-08',
          amount: 120_000,
          direction: 'in',
          sourceId: 'src-bank',
          potId: null,
          category: 'parttime',
          note: 'พาร์ทไทม์เสาร์อาทิตย์',
          createdAt: '2026-11-08T18:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
      ],
    };

    const result = forecast(withFutureParttime, 'src-bank', '2026-11-15');
    expect(result.incoming).toBe(510_000);
  });

  it('SPEC §5 C5: orders timeline by date with outflows before inflows on the same day and computes low point', () => {
    const result = forecast(financeFixture, 'src-bank', '2026-11-15');

    // On 2026-11-24: credit card bill (out 107,700) runs BEFORE Mom's income (in 510,000),
    // dipping balance to 360,300 before rising to 870,300.
    expect(result.timeline).toEqual([
      {
        date: '2026-11-24',
        kind: 'bill',
        direction: 'out',
        title: 'บิล บัตรเครดิต',
        amount: 107_700,
        balance: 360_300,
      },
      {
        date: '2026-11-24',
        kind: 'income',
        direction: 'in',
        title: 'เงินจากแม่',
        amount: 510_000,
        balance: 870_300,
      },
      {
        date: '2026-11-25',
        kind: 'plan',
        direction: 'out',
        title: 'ค่าหอ',
        amount: 150_000,
        balance: 720_300,
      },
      {
        date: '2026-11-28',
        kind: 'plan',
        direction: 'out',
        title: 'เก็บ',
        amount: 200_000,
        balance: 520_300,
      },
      {
        date: '2026-12-10',
        kind: 'bill',
        direction: 'out',
        title: 'บิล SPayLater',
        amount: 138_193,
        balance: 382_107,
      },
    ]);

    expect(result.low).toEqual({
      date: '2026-11-24',
      balance: 360_300,
    });
  });

  it('SPEC §5 C5: clamps negative pot left to 0 in potsLeft and excludes completed PlanItems', () => {
    const overspentAndDonePlan: FinanceData = {
      ...financeFixture,
      transactions: [
        ...financeFixture.transactions,
        // Overspend play pot by 100,000 so playPot.left = -33,793 (< 0 -> clamped to 0)
        {
          id: 'tx-overspend',
          date: '2026-11-14',
          amount: 100_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-play',
          category: 'shopping',
          note: 'ของใหญ่',
          createdAt: '2026-11-14T15:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        // Completed plan-dorm transaction
        {
          id: 'tx-done-dorm',
          date: '2026-11-15',
          amount: 150_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: null,
          category: 'bills',
          note: 'ค่าหอ',
          createdAt: '2026-11-15T10:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
      ],
      planItems: financeFixture.planItems.map((p) =>
        p.id === 'plan-dorm' ? { ...p, doneTxId: 'tx-done-dorm' } : p,
      ),
    };

    const result = forecast(overspentAndDonePlan, 'src-bank', '2026-11-15');
    // Only essentialPot (720,000) contributes to potsLeft; negative playPot (-33,793) is clamped to 0
    expect(result.potsLeft).toBe(720_000);
    // Only plan-save (200,000) remains undone
    expect(result.plans).toBe(200_000);
  });
});
