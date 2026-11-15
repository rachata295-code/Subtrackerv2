import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { financeFixture } from './fixtures/finance';
import * as domain from './domain';
import { useFinanceData } from './hooks/useFinance';
import type { FinanceData, Outflow, PotStatus, UseFinanceData } from './types/finance';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('financeFixture', () => {
  it('conforms to FinanceData and stores every money amount as an integer satang', () => {
    const data: FinanceData = financeFixture;
    expect(Number.isInteger(data.settings.salary)).toBe(true);
    expect(data.settings.salary).toBe(1_020_000);
    expect(data.settings.payDay).toBe(10);

    for (const pot of data.pots) expect(Number.isInteger(pot.perPeriod)).toBe(true);
    for (const sub of data.subscriptions) expect(Number.isInteger(sub.amount)).toBe(true);
    for (const inst of data.installments) expect(Number.isInteger(inst.perInstallment)).toBe(true);
    for (const tx of data.transactions) expect(Number.isInteger(tx.amount)).toBe(true);
    for (const pay of data.payments) expect(Number.isInteger(pay.amount)).toBe(true);
  });

  it('sums credit card subscriptions to 107700 satang (฿1,077.00)', () => {
    const card = financeFixture.sources.find((s) => s.kind === 'credit_card');
    expect(card).toBeDefined();
    expect(card?.statementCloseDay).toBe(10);
    expect(card?.dueDay).toBe(24);
    expect(card?.dueMonthOffset).toBe(0);

    const cardSubs = financeFixture.subscriptions.filter((s) => s.sourceId === card?.id && s.active);
    const total = cardSubs.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBe(107_700);
  });

  it('includes AirPods installment (10 x 138193 satang on SPayLater) and Nov play spending (42000 satang)', () => {
    const spay = financeFixture.sources.find((s) => s.kind === 'paylater');
    const playPot = financeFixture.pots.find((p) => p.name === 'ใช้ตามใจ');
    expect(spay?.dueDay).toBe(10);
    expect(spay?.dueMonthOffset).toBe(1);
    expect(playPot?.perPeriod).toBe(300_000);
    expect(playPot?.rollover).toBe(true);

    const airpods = financeFixture.installments.find((i) => i.name.includes('AirPods'));
    expect(airpods).toBeDefined();
    expect(airpods?.count).toBe(10);
    expect(airpods?.perInstallment).toBe(138_193);
    expect(airpods?.sourceId).toBe(spay?.id);
    expect(airpods?.potId).toBe(playPot?.id);
    // Sep 2026 first charge -> #1 Sep, #2 Oct, #3 Nov 2026.
    expect(airpods?.firstChargeDate.startsWith('2026-09-')).toBe(true);

    const novTx = financeFixture.transactions.filter(
      (t) => t.date >= '2026-11-10' && t.date <= '2026-12-09' && t.potId === playPot?.id,
    );
    expect(novTx.reduce((sum, t) => sum + t.amount, 0)).toBe(42_000);

    const octTx = financeFixture.transactions.filter(
      (t) => t.date >= '2026-10-10' && t.date <= '2026-11-09' && t.potId === playPot?.id,
    );
    const octSpent = octTx.reduce((sum, t) => sum + t.amount, 0);
    expect((playPot?.perPeriod ?? 0) - 107_700 - 138_193 - octSpent).toBe(54_100);
  });
});

describe('domain contracts', () => {
  it('exports all SPEC §4 domain functions matching the shared contracts', () => {
    const card = financeFixture.sources[1]!;
    const sub = financeFixture.subscriptions[0]!;
    const inst = financeFixture.installments[0]!;
    const pot = financeFixture.pots[0]!;

    expect(domain.payPeriod('2026-11-15', 10).key).toBe('2026-11');
    expect(domain.statementFor(card, '2026-11-01').key).toBe('2026-11');
    expect(domain.subscriptionCharges(sub, '2026-11-01', '2026-11-30')).toHaveLength(1);
    expect(domain.installmentSchedule(inst)).toHaveLength(10);
    expect(domain.billAmount(card, '2026-11', financeFixture)).toBe(107_700);
    expect(domain.upcomingOutflows(financeFixture, '2026-11-15').length).toBeGreaterThan(0);
    expect(domain.potStatus(pot, '2026-11', financeFixture).left).toBe(66_207);
  });

  it('exports PotStatus and Outflow contract types', () => {
    const status: PotStatus = { carryIn: 0, budget: 0, reserved: 0, spent: 0, left: 0, over: false };
    const outflow: Outflow = {
      date: '2026-11-24',
      dueBy: false,
      title: 'จ่ายบิลบัตร',
      amount: 107_700,
      sourceId: 'src-card',
      kind: 'bill',
      counted: true,
      statementKey: '2026-11',
    };
    expect(status.over).toBe(false);
    expect(outflow.counted).toBe(true);
  });
});

describe('useFinanceData contract', () => {
  it('returns financeFixture when VITE_USE_FIXTURES is "1"', () => {
    vi.stubEnv('VITE_USE_FIXTURES', '1');
    const { result } = renderHook(() => useFinanceData());
    const state: UseFinanceData = result.current;
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.data).toEqual(financeFixture);
    expect(typeof state.refetch).toBe('function');
  });

  it('returns a clear Thai config error when Supabase env vars are missing outside fixture mode', () => {
    vi.stubEnv('VITE_USE_FIXTURES', '0');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { result } = renderHook(() => useFinanceData());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error?.message).toMatch(/VITE_SUPABASE_URL/);
    expect(typeof result.current.refetch).toBe('function');
  });
});
