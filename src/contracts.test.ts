import { createElement, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { financeFixture } from './fixtures/finance';
import * as domain from './domain';
import * as financeRepo from './data/financeRepo';
import {
  useCompletePlanItem,
  useConfirmIncome,
  useCreateBalanceCheck,
  useCreateTransactions,
  useDeletePlanItem,
  useDeleteRecurringIncome,
  useFinanceData,
  useUncompletePlanItem,
  useUpsertPlanItem,
  useUpsertRecurringIncome,
} from './hooks/useFinance';
import {
  CATEGORY_LABELS,
  IN_CATEGORIES,
  OUT_CATEGORIES,
  type BalanceCheck,
  type Category,
  type FinanceData,
  type Outflow,
  type PlanItem,
  type PotStatus,
  type RecurringIncome,
  type UseFinanceData,
} from './types/finance';

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
    for (const tx of data.transactions) {
      expect(Number.isInteger(tx.amount)).toBe(true);
      expect(typeof tx.createdAt).toBe('string');
      expect(tx.createdAt.length).toBeGreaterThan(0);
    }
    for (const pay of data.payments) {
      expect(Number.isInteger(pay.amount)).toBe(true);
      expect(typeof pay.createdAt).toBe('string');
      expect(pay.createdAt.length).toBeGreaterThan(0);
    }
    for (const chk of data.balanceChecks) {
      expect(Number.isInteger(chk.actual)).toBe(true);
      expect(typeof chk.createdAt).toBe('string');
    }
    for (const item of data.planItems) {
      expect(Number.isInteger(item.amount)).toBe(true);
    }
    for (const inc of data.recurringIncomes) {
      expect(Number.isInteger(inc.amount)).toBe(true);
    }
  });

  it('includes Phase 2 fixtures: RecurringIncome (10 & 24), initial BalanceCheck (2026-11-10), PlanItems, and hotbar transactions', () => {
    const momIncomes: RecurringIncome[] = financeFixture.recurringIncomes.filter(
      (r) => r.name === 'เงินจากแม่' && r.sourceId === 'src-bank' && r.active,
    );
    expect(momIncomes.map((r) => r.dayOfMonth).sort((a, b) => a - b)).toEqual([10, 24]);
    expect(momIncomes.every((r) => r.amount === 510_000)).toBe(true);

    const bankChecks: BalanceCheck[] = financeFixture.balanceChecks.filter(
      (c) => c.sourceId === 'src-bank' && c.checkedOn === '2026-11-10',
    );
    expect(bankChecks).toHaveLength(1);
    expect(bankChecks[0]?.expectedBefore).toBeNull();

    const novPlans: PlanItem[] = financeFixture.planItems.filter((p) => p.periodKey === '2026-11');
    expect(novPlans).toHaveLength(2);
    expect(novPlans.find((p) => p.kind === 'pay' && p.name === 'ค่าหอ')?.amount).toBe(150_000);
    expect(novPlans.find((p) => p.kind === 'save' && p.name === 'เก็บ')?.amount).toBe(200_000);

    const chickenRice = financeFixture.transactions.filter(
      (t) => t.direction === 'out' && t.note === 'ข้าวมันไก่' && t.amount === 4_500,
    );
    expect(chickenRice.length).toBeGreaterThanOrEqual(3);

    const milkTea = financeFixture.transactions.filter(
      (t) => t.direction === 'out' && t.note === 'ชานม' && t.amount === 8_500,
    );
    expect(milkTea.length).toBeGreaterThanOrEqual(2);
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

describe('Phase 2 category constants', () => {
  it('exports OUT_CATEGORIES, IN_CATEGORIES, and Thai CATEGORY_LABELS for all 12 categories', () => {
    expect(OUT_CATEGORIES).toEqual([
      'food',
      'transport',
      'shopping',
      'entertainment',
      'health',
      'bills',
      'other',
      'savings',
      'unknown',
    ]);
    expect(IN_CATEGORIES).toEqual(['allowance', 'parttime', 'freelance', 'other', 'unknown']);

    const allCategories: Category[] = [
      'food',
      'transport',
      'shopping',
      'entertainment',
      'health',
      'bills',
      'other',
      'savings',
      'unknown',
      'allowance',
      'parttime',
      'freelance',
    ];
    for (const cat of allCategories) {
      expect(typeof CATEGORY_LABELS[cat]).toBe('string');
      expect(CATEGORY_LABELS[cat].length).toBeGreaterThan(0);
    }
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

  it('exports Phase 2 domain functions matching SPEC §6 signatures', () => {
    expect(domain.spendingByCategory(financeFixture, '2026-11').total).toBe(287_893);
    expect(domain.spendingHistory(financeFixture, '2026-11', 6)).toHaveLength(6);
    expect(domain.hotbarItems(financeFixture, '2026-11-15', 8).length).toBeGreaterThanOrEqual(2);
    expect(domain.evaluateAmountExpression('45+60')).toEqual({ value: 10_500 });
    expect(domain.expectedBalance('src-bank', financeFixture)).toBe(468_000);
    expect(domain.pendingIncomes(financeFixture, '2026-11-15')).toHaveLength(1);
    expect(domain.forecast(financeFixture, 'src-bank', '2026-11-15').start).toBe(468_000);
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

describe('Phase 2 repo stubs and fixture-mode hooks', () => {
  it('exports Phase 2 repo functions on financeRepo', () => {
    expect(typeof financeRepo.createTransactions).toBe('function');
    expect(typeof financeRepo.createBalanceCheck).toBe('function');
    expect(typeof financeRepo.upsertPlanItem).toBe('function');
    expect(typeof financeRepo.deletePlanItem).toBe('function');
    expect(typeof financeRepo.completePlanItem).toBe('function');
    expect(typeof financeRepo.uncompletePlanItem).toBe('function');
    expect(typeof financeRepo.upsertRecurringIncome).toBe('function');
    expect(typeof financeRepo.deleteRecurringIncome).toBe('function');
    expect(typeof financeRepo.confirmIncome).toBe('function');
  });

  it('supports Phase 2 mutation hooks in fixture mode (in-memory)', async () => {
    vi.stubEnv('VITE_USE_FIXTURES', '1');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => ({
        finance: useFinanceData(),
        createTransactions: useCreateTransactions(),
        createBalanceCheck: useCreateBalanceCheck(),
        upsertPlanItem: useUpsertPlanItem(),
        deletePlanItem: useDeletePlanItem(),
        completePlanItem: useCompletePlanItem(),
        uncompletePlanItem: useUncompletePlanItem(),
        upsertRecurringIncome: useUpsertRecurringIncome(),
        deleteRecurringIncome: useDeleteRecurringIncome(),
        confirmIncome: useConfirmIncome(),
      }),
      { wrapper },
    );

    await act(async () => {
      const batch = await result.current.createTransactions.mutateAsync([
        {
          date: '2026-11-15',
          amount: 4_500,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'food',
          note: 'ข้าวมันไก่',
        },
      ]);
      expect(batch).toHaveLength(1);

      const check = await result.current.createBalanceCheck.mutateAsync({
        sourceId: 'src-bank',
        checkedOn: '2026-11-15',
        actual: 450_000,
        expectedBefore: 463_500,
        adjustment: { amount: 13_500, direction: 'out' },
      });
      expect(check.actual).toBe(450_000);
      expect(check.adjustmentTxId).toBeTruthy();

      const plan = await result.current.upsertPlanItem.mutateAsync({
        periodKey: '2026-11',
        name: 'ค่าเน็ต',
        amount: 60_000,
        kind: 'pay',
        sourceId: 'src-bank',
        dueOn: '2026-11-20',
        category: 'bills',
      });
      const completed = await result.current.completePlanItem.mutateAsync(plan.id);
      expect(completed.doneTxId).toBeTruthy();
      const uncompleted = await result.current.uncompletePlanItem.mutateAsync(plan.id);
      expect(uncompleted.doneTxId).toBeNull();
      await result.current.deletePlanItem.mutateAsync(plan.id);

      const rec = await result.current.upsertRecurringIncome.mutateAsync({
        name: 'ทุน',
        amount: 200_000,
        dayOfMonth: 15,
        sourceId: 'src-bank',
        active: true,
      });
      const confirmedTx = await result.current.confirmIncome.mutateAsync({
        recurringIncomeId: rec.id,
        incomeDueOn: '2026-11-15',
        amount: 200_000,
        date: '2026-11-15',
      });
      expect(confirmedTx.direction).toBe('in');
      expect(confirmedTx.category).toBe('allowance');
      expect(confirmedTx.recurringIncomeId).toBe(rec.id);
      expect(confirmedTx.incomeDueOn).toBe('2026-11-15');
      await result.current.deleteRecurringIncome.mutateAsync(rec.id);
    });
  });
});

describe('Phase 2 SQL migration & schema contracts', () => {
  it('defines idempotent Phase 2 migration and keeps schema.sql in sync', () => {
    const migrationSql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/2026-11-16-phase2.sql'),
      'utf8',
    );
    const schemaSql = readFileSync(resolve(process.cwd(), 'supabase/schema.sql'), 'utf8');

    for (const sql of [migrationSql, schemaSql]) {
      expect(sql).toMatch(/create table if not exists public\.recurring_incomes/i);
      expect(sql).toMatch(/create table if not exists public\.balance_checks/i);
      expect(sql).toMatch(/create table if not exists public\.plan_items/i);

      for (const cat of ['savings', 'unknown', 'allowance', 'parttime', 'freelance']) {
        expect(sql).toContain(`'${cat}'`);
      }

      expect(sql).toMatch(/recurring_income_id\s+uuid\s+references\s+public\.recurring_incomes\(id\)\s+on delete set null/i);
      expect(sql).toMatch(/income_due_on\s+date/i);

      expect(sql).toMatch(/alter table public\.recurring_incomes enable row level security/i);
      expect(sql).toMatch(/alter table public\.balance_checks enable row level security/i);
      expect(sql).toMatch(/alter table public\.plan_items enable row level security/i);

      expect(sql).toMatch(/idx_recurring_incomes_user/i);
      expect(sql).toMatch(/idx_balance_checks_user/i);
      expect(sql).toMatch(/idx_plan_items_user/i);
    }

    expect(migrationSql).toMatch(/drop constraint if exists/i);
    expect(migrationSql).toMatch(/add column if not exists recurring_income_id/i);
    expect(migrationSql).toMatch(/add column if not exists income_due_on/i);
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
