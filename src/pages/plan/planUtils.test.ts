import { describe, expect, it } from 'vitest';
import { financeFixture } from '../../fixtures/finance';
import type { FinanceData } from '../../types/finance';
import {
  balanceCheckDiffText,
  daysSinceBalanceCheckLabel,
  findDuplicateBillMatch,
  latestBalanceCheckForSource,
  pickDefaultBankSource,
  shiftDueDateToPeriod,
} from './planUtils';

describe('planUtils', () => {
  it('picks the bank source with the highest active recurring income sum', () => {
    const data: FinanceData = {
      ...financeFixture,
      sources: [
        ...financeFixture.sources,
        {
          id: 'src-bank-2',
          name: 'ไทยพาณิชย์',
          kind: 'bank',
          hue: 'lilac',
          archived: false,
          statementCloseDay: null,
          dueDay: null,
          dueMonthOffset: null,
          payFromSourceId: null,
        },
      ],
      recurringIncomes: [
        { id: 'r1', name: 'A', amount: 200_000, dayOfMonth: 10, sourceId: 'src-bank', active: true },
        { id: 'r2', name: 'B', amount: 500_000, dayOfMonth: 10, sourceId: 'src-bank-2', active: true },
        { id: 'r3', name: 'C', amount: 900_000, dayOfMonth: 25, sourceId: 'src-bank', active: false },
      ],
    };

    expect(pickDefaultBankSource(data)?.id).toBe('src-bank-2');
  });

  it('finds latest balance check sorted by checkedOn then createdAt and formats days-ago label', () => {
    const data: FinanceData = {
      ...financeFixture,
      balanceChecks: [
        {
          id: 'chk-1',
          sourceId: 'src-bank',
          checkedOn: '2026-11-10',
          actual: 500_000,
          expectedBefore: null,
          adjustmentTxId: null,
          createdAt: '2026-11-10T08:00:00.000Z',
        },
        {
          id: 'chk-2',
          sourceId: 'src-bank',
          checkedOn: '2026-11-10',
          actual: 510_000,
          expectedBefore: 500_000,
          adjustmentTxId: null,
          createdAt: '2026-11-10T18:00:00.000Z',
        },
      ],
    };

    expect(latestBalanceCheckForSource(data.balanceChecks, 'src-bank')?.id).toBe('chk-2');
    expect(daysSinceBalanceCheckLabel('2026-11-10', '2026-11-10')).toBe('เช็กยอดวันนี้');
    expect(daysSinceBalanceCheckLabel('2026-11-10', '2026-11-15')).toBe('เช็กยอด 5 วันก่อน');
    expect(daysSinceBalanceCheckLabel(null, '2026-11-15')).toBe('ยังไม่เคยเช็กยอด');
  });

  it('formats balance check history diff descriptions', () => {
    expect(
      balanceCheckDiffText({
        id: 'c1',
        sourceId: 'src-bank',
        checkedOn: '2026-11-10',
        actual: 510_000,
        expectedBefore: null,
        adjustmentTxId: null,
        createdAt: '2026-11-10T08:00:00.000Z',
      }),
    ).toBe('ตั้งยอดเริ่มต้น');

    expect(
      balanceCheckDiffText({
        id: 'c2',
        sourceId: 'src-bank',
        checkedOn: '2026-11-15',
        actual: 455_000,
        expectedBefore: 468_000,
        adjustmentTxId: 'tx-adj-1',
        createdAt: '2026-11-15T08:00:00.000Z',
      }),
    ).toBe('ต่าง −฿130.00 (ลืมจด)');

    expect(
      balanceCheckDiffText({
        id: 'c3',
        sourceId: 'src-bank',
        checkedOn: '2026-11-15',
        actual: 468_050,
        expectedBefore: 468_000,
        adjustmentTxId: null,
        createdAt: '2026-11-15T08:00:00.000Z',
      }),
    ).toBe('ตรงกัน');
  });

  it('detects duplicate plan names matching credit cards, paylater bills, subscriptions, or installments', () => {
    expect(findDuplicateBillMatch('จ่ายบัตรเครดิต', financeFixture)).toBe('บัตรเครดิต');
    expect(findDuplicateBillMatch('spaylater', financeFixture)).toBe('SPayLater');
    expect(findDuplicateBillMatch('Claude', financeFixture)).toBe('Claude');
    expect(findDuplicateBillMatch('ค่าหอ', financeFixture)).toBeNull();
  });

  it('shifts dueOn date forward by one pay period with month-end clamping', () => {
    expect(shiftDueDateToPeriod('2026-10-31', '2026-11-10', '2026-12-09')).toBe('2026-11-30');
    expect(shiftDueDateToPeriod('2026-10-25', '2026-11-10', '2026-12-09')).toBe('2026-11-25');
    expect(shiftDueDateToPeriod(null, '2026-11-10', '2026-12-09')).toBeNull();
  });
});
