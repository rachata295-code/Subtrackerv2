import { describe, expect, it } from 'vitest';
import { financeFixture } from '../fixtures/finance';
import type { FinanceData } from '../types/finance';
import { expectedBalance } from './balance';

describe('SPEC §5 C2: expectedBalance', () => {
  it('SPEC §5 C2: returns null when source has no BalanceCheck or is not a bank account', () => {
    const noCheckData: FinanceData = {
      ...financeFixture,
      balanceChecks: [],
    };
    expect(expectedBalance('src-bank', noCheckData)).toBeNull();
    expect(expectedBalance('src-card', financeFixture)).toBeNull();
    expect(expectedBalance('src-spay', financeFixture)).toBeNull();
  });

  it('SPEC §5 C2: computes expected balance from fixture initial check (510,000 - 42,000 = 468,000)', () => {
    expect(expectedBalance('src-bank', financeFixture)).toBe(468_000);
  });

  it('SPEC §5 C2: counts same-day afternoon purchase after morning check (date = checkedOn, createdAt > check.createdAt)', () => {
    const data: FinanceData = {
      ...financeFixture,
      transactions: [
        ...financeFixture.transactions,
        // Same day as chk-nov-init (2026-11-10, createdAt 08:00:00Z), bought at 13:00:00Z -> counted!
        {
          id: 'tx-same-day-afternoon',
          date: '2026-11-10',
          amount: 5_500,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-play',
          category: 'food',
          note: 'กาแฟบ่าย',
          createdAt: '2026-11-10T13:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        // Same day as chk-nov-init, but created at 07:30:00Z before check -> NOT counted!
        {
          id: 'tx-same-day-morning',
          date: '2026-11-10',
          amount: 3_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-play',
          category: 'food',
          note: 'โจ๊กเช้า',
          createdAt: '2026-11-10T07:30:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
      ],
    };

    expect(expectedBalance('src-bank', data)).toBe(468_000 - 5_500);
  });

  it('SPEC §5 C2: ignores backdated transactions with date < checkedOn even if createdAt > check.createdAt', () => {
    const data: FinanceData = {
      ...financeFixture,
      transactions: [
        ...financeFixture.transactions,
        {
          id: 'tx-backdated-before-check',
          date: '2026-11-09',
          amount: 20_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-play',
          category: 'shopping',
          note: 'เพิ่งนึกออกของเมื่อวาน',
          createdAt: '2026-11-12T10:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
      ],
    };

    expect(expectedBalance('src-bank', data)).toBe(468_000);
  });

  it('SPEC §5 C2: does not double-count adjustment transaction (unknown) created on checkedOn before/at the new BalanceCheck', () => {
    const data: FinanceData = {
      ...financeFixture,
      transactions: [
        ...financeFixture.transactions,
        {
          id: 'tx-adj-nov15',
          date: '2026-11-15',
          amount: 13_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: null,
          category: 'unknown',
          note: 'ส่วนต่างเช็กยอด',
          createdAt: '2026-11-15T09:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
      ],
      balanceChecks: [
        ...financeFixture.balanceChecks,
        {
          id: 'chk-nov15',
          sourceId: 'src-bank',
          checkedOn: '2026-11-15',
          actual: 455_000,
          expectedBefore: 468_000,
          adjustmentTxId: 'tx-adj-nov15',
          createdAt: '2026-11-15T09:00:01.000Z',
        },
      ],
    };

    expect(expectedBalance('src-bank', data)).toBe(455_000);
  });

  it('SPEC §5 C2: uses the latest check by createdAt when multiple checks exist on the same checkedOn date', () => {
    const data: FinanceData = {
      ...financeFixture,
      balanceChecks: [
        ...financeFixture.balanceChecks,
        {
          id: 'chk-nov15-morning',
          sourceId: 'src-bank',
          checkedOn: '2026-11-15',
          actual: 450_000,
          expectedBefore: 468_000,
          adjustmentTxId: null,
          createdAt: '2026-11-15T08:00:00.000Z',
        },
        {
          id: 'chk-nov15-evening',
          sourceId: 'src-bank',
          checkedOn: '2026-11-15',
          actual: 420_000,
          expectedBefore: 450_000,
          adjustmentTxId: null,
          createdAt: '2026-11-15T20:00:00.000Z',
        },
      ],
      transactions: [
        ...financeFixture.transactions,
        // Between morning and evening check -> already reflected in evening check actual (420,000)
        {
          id: 'tx-nov15-lunch',
          date: '2026-11-15',
          amount: 30_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-play',
          category: 'food',
          note: 'มื้อเที่ยง',
          createdAt: '2026-11-15T12:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
        // After evening check -> subtracted from 420,000
        {
          id: 'tx-nov15-late',
          date: '2026-11-15',
          amount: 5_000,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-play',
          category: 'food',
          note: 'มื้อดึก',
          createdAt: '2026-11-15T21:00:00.000Z',
          recurringIncomeId: null,
          incomeDueOn: null,
        },
      ],
    };

    expect(expectedBalance('src-bank', data)).toBe(415_000);
  });

  it('SPEC §5 C2: adds direction="in" transactions and subtracts BillPayments whose source.payFromSourceId matches the bank', () => {
    const data: FinanceData = {
      ...financeFixture,
      transactions: [
        ...financeFixture.transactions,
        {
          id: 'tx-nov-mom-24',
          date: '2026-11-24',
          amount: 510_000,
          direction: 'in',
          sourceId: 'src-bank',
          potId: null,
          category: 'allowance',
          note: 'เงินจากแม่',
          createdAt: '2026-11-24T10:00:00.000Z',
          recurringIncomeId: 'inc-mom-24',
          incomeDueOn: '2026-11-24',
        },
      ],
      payments: [
        ...financeFixture.payments,
        {
          id: 'pay-nov-card',
          sourceId: 'src-card', // payFromSourceId = 'src-bank'
          statementKey: '2026-11',
          amount: 107_700,
          paidOn: '2026-11-24',
          createdAt: '2026-11-24T11:00:00.000Z',
        },
      ],
    };

    // 468,000 + 510,000 - 107,700 = 870,300
    expect(expectedBalance('src-bank', data)).toBe(870_300);
  });
});
