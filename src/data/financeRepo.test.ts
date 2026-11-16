import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { financeFixture } from '../fixtures/finance';
import {
  clearAllData,
  completePlanItem,
  confirmIncome,
  createBalanceCheck,
  createTransaction,
  createTransactions,
  deleteBillPayment,
  deleteInstallment,
  deletePlanItem,
  deletePot,
  deleteRecurringIncome,
  deleteSource,
  deleteSubscription,
  deleteTransaction,
  loadFinanceData,
  mapBalanceCheckFromRow,
  mapBalanceCheckToRow,
  mapBillPaymentFromRow,
  mapBillPaymentToRow,
  mapInstallmentFromRow,
  mapPlanItemFromRow,
  mapPlanItemToRow,
  mapPotFromRow,
  mapRecurringIncomeFromRow,
  mapRecurringIncomeToRow,
  mapSettingsFromRow,
  mapSourceFromRow,
  mapSubscriptionFromRow,
  mapTransactionFromRow,
  mapTransactionToRow,
  numericToSatang,
  payBill,
  satangToNumeric,
  seedDefaults,
  uncompletePlanItem,
  updateSettings,
  updateTransaction,
  upsertInstallment,
  upsertPlanItem,
  upsertPot,
  upsertRecurringIncome,
  upsertSource,
  upsertSubscription,
} from './financeRepo';

describe('money numeric <-> satang mappers', () => {
  it.each([
    ['1381.93', 138193],
    ['1077.00', 107700],
    ['10200.00', 1020000],
    ['0.07', 7],
    ['19.99', 1999],
    ['0.00', 0],
    ['3000.00', 300000],
  ])('round-trips %s <-> %i without floating-point drift', (numericStr, satang) => {
    expect(numericToSatang(numericStr)).toBe(satang);
    expect(satangToNumeric(satang)).toBe(numericStr);
    expect(numericToSatang(satangToNumeric(satang))).toBe(satang);
  });

  it('handles numeric numbers returned by drivers as well as strings', () => {
    expect(numericToSatang(1381.93)).toBe(138193);
    expect(numericToSatang(19.99)).toBe(1999);
  });

  it('throws Thai error for non-finite numeric input', () => {
    expect(() => numericToSatang('abc')).toThrow(/จำนวนเงินไม่ถูกต้อง/);
  });
});

describe('entity snake_case <-> camelCase mappers', () => {
  it('maps all seven entity rows accurately', () => {
    expect(
      mapSettingsFromRow({ user_id: 'u1', salary: '10200.00', pay_day: 10, budget_start_period: null }),
    ).toEqual({
      userId: 'u1',
      salary: 1020000,
      payDay: 10,
      budgetStartPeriod: null,
    });
    expect(
      mapSettingsFromRow({ user_id: 'u1', salary: '10200.00', pay_day: 10, budget_start_period: '2026-11' })
        .budgetStartPeriod,
    ).toBe('2026-11');

    expect(
      mapSourceFromRow({
        id: 'src-1',
        name: 'บัตรเครดิต',
        kind: 'credit_card',
        hue: 'sky',
        archived: false,
        statement_close_day: 10,
        due_day: 24,
        due_month_offset: 0,
        pay_from_source_id: 'src-bank',
      }),
    ).toEqual({
      id: 'src-1',
      name: 'บัตรเครดิต',
      kind: 'credit_card',
      hue: 'sky',
      archived: false,
      statementCloseDay: 10,
      dueDay: 24,
      dueMonthOffset: 0,
      payFromSourceId: 'src-bank',
    });

    expect(
      mapPotFromRow({
        id: 'pot-1',
        name: 'ใช้ตามใจ',
        per_period: '3000.00',
        rollover: true,
        hue: 'teal',
      }),
    ).toEqual({
      id: 'pot-1',
      name: 'ใช้ตามใจ',
      perPeriod: 300000,
      rollover: true,
      hue: 'teal',
    });

    expect(
      mapSubscriptionFromRow({
        id: 'sub-1',
        name: 'Claude',
        amount: '699.00',
        frequency: 'monthly',
        billing_day: 1,
        billing_month: null,
        source_id: 'src-1',
        pot_id: 'pot-1',
        active: true,
      }),
    ).toEqual({
      id: 'sub-1',
      name: 'Claude',
      amount: 69900,
      frequency: 'monthly',
      billingDay: 1,
      billingMonth: null,
      sourceId: 'src-1',
      potId: 'pot-1',
      active: true,
    });

    expect(
      mapInstallmentFromRow({
        id: 'inst-1',
        name: 'AirPods',
        per_installment: '1381.93',
        count: 10,
        first_charge_date: '2026-09-01',
        source_id: 'src-spay',
        pot_id: 'pot-1',
      }),
    ).toEqual({
      id: 'inst-1',
      name: 'AirPods',
      perInstallment: 138193,
      count: 10,
      firstChargeDate: '2026-09-01',
      sourceId: 'src-spay',
      potId: 'pot-1',
    });

    expect(
      mapTransactionFromRow({
        id: 'tx-1',
        date: '2026-11-11',
        amount: '220.00',
        direction: 'out',
        source_id: 'src-bank',
        pot_id: 'pot-1',
        category: 'entertainment',
        note: 'หนัง',
      }),
    ).toEqual({
      id: 'tx-1',
      date: '2026-11-11',
      amount: 22000,
      direction: 'out',
      sourceId: 'src-bank',
      potId: 'pot-1',
      category: 'entertainment',
      note: 'หนัง',
      createdAt: '1970-01-01T00:00:00.000Z',
      recurringIncomeId: null,
      incomeDueOn: null,
    });

    expect(
      mapBillPaymentFromRow({
        id: 'pay-1',
        source_id: 'src-1',
        statement_key: '2026-10',
        amount: '1077.00',
        paid_on: '2026-10-24',
      }),
    ).toEqual({
      id: 'pay-1',
      sourceId: 'src-1',
      statementKey: '2026-10',
      amount: 107700,
      paidOn: '2026-10-24',
      createdAt: '1970-01-01T00:00:00.000Z',
    });
  });
});

interface QueryResult {
  data: unknown;
  error: unknown;
}

function makeQueryBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

describe('financeRepo with mocked Supabase client', () => {
  it('loadFinanceData loads and maps all tables', async () => {
    const tableResults: Record<string, QueryResult> = {
      settings: {
        data: { user_id: 'u1', salary: '10200.00', pay_day: 10, budget_start_period: '2026-11' },
        error: null,
      },
      payment_sources: {
        data: [
          {
            id: 'src-bank',
            name: 'บัญชี',
            kind: 'bank',
            hue: 'stone',
            archived: false,
            statement_close_day: null,
            due_day: null,
            due_month_offset: null,
            pay_from_source_id: null,
          },
        ],
        error: null,
      },
      pots: {
        data: [{ id: 'pot-play', name: 'ใช้ตามใจ', per_period: '3000.00', rollover: true, hue: 'teal' }],
        error: null,
      },
      subscriptions: {
        data: [
          {
            id: 'sub-claude',
            name: 'Claude',
            amount: '699.00',
            frequency: 'monthly',
            billing_day: 1,
            billing_month: null,
            source_id: 'src-bank',
            pot_id: 'pot-play',
            active: true,
          },
        ],
        error: null,
      },
      installments: {
        data: [
          {
            id: 'inst-airpods',
            name: 'AirPods',
            per_installment: '1381.93',
            count: 10,
            first_charge_date: '2026-09-01',
            source_id: 'src-bank',
            pot_id: 'pot-play',
          },
        ],
        error: null,
      },
      transactions: {
        data: [
          {
            id: 'tx-1',
            date: '2026-11-11',
            amount: '220.00',
            direction: 'out',
            source_id: 'src-bank',
            pot_id: 'pot-play',
            category: 'entertainment',
            note: 'หนัง',
          },
        ],
        error: null,
      },
      bill_payments: {
        data: [
          {
            id: 'pay-1',
            source_id: 'src-bank',
            statement_key: '2026-10',
            amount: '1077.00',
            paid_on: '2026-10-24',
            created_at: '2026-10-24T09:00:00.000Z',
          },
        ],
        error: null,
      },
      balance_checks: {
        data: [
          {
            id: 'chk-nov-init',
            source_id: 'src-bank',
            checked_on: '2026-11-10',
            actual: '5100.00',
            expected_before: null,
            adjustment_tx_id: null,
            created_at: '2026-11-10T08:00:00.000Z',
          },
        ],
        error: null,
      },
      plan_items: {
        data: [
          {
            id: 'plan-dorm',
            period_key: '2026-11',
            name: 'ค่าหอ',
            amount: '1500.00',
            kind: 'pay',
            source_id: 'src-bank',
            due_on: '2026-11-25',
            category: 'bills',
            done_tx_id: null,
            sort_order: 1,
          },
        ],
        error: null,
      },
      recurring_incomes: {
        data: [
          {
            id: 'inc-mom-10',
            name: 'เงินจากแม่',
            amount: '5100.00',
            day_of_month: 10,
            source_id: 'src-bank',
            active: true,
          },
        ],
        error: null,
      },
    };

    const client = {
      from: vi.fn((table: string) => makeQueryBuilder(tableResults[table]!)),
    } as unknown as SupabaseClient;

    const data = await loadFinanceData(client);
    expect(data.settings).toEqual({ userId: 'u1', salary: 1020000, payDay: 10, budgetStartPeriod: '2026-11' });
    expect(data.installments[0]?.perInstallment).toBe(138193);
    expect(data.transactions[0]?.amount).toBe(22000);
    expect(data.payments[0]?.statementKey).toBe('2026-10');
    expect(data.payments[0]?.createdAt).toBe('2026-10-24T09:00:00.000Z');
    expect(data.balanceChecks).toEqual([financeFixture.balanceChecks[0]]);
    expect(data.planItems).toEqual([financeFixture.planItems[0]]);
    expect(data.recurringIncomes).toEqual([financeFixture.recurringIncomes[0]]);
  });

  it('wraps Supabase query failures as Thai Error with cause', async () => {
    const dbError = { message: 'permission denied', code: '42501' };
    const client = {
      from: vi.fn(() => makeQueryBuilder({ data: null, error: dbError })),
    } as unknown as SupabaseClient;

    let caught: unknown;
    try {
      await loadFinanceData(client);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    const err = caught as Error & { cause?: unknown };
    expect(err.message).toMatch(/[\u0E00-\u0E7F]/);
    expect(err.cause).toEqual(dbError);
  });

  it.each(['balance_checks', 'plan_items', 'recurring_incomes'] as const)(
    'wraps %s query failure in loadFinanceData as Thai Error with cause',
    async (failingTable) => {
      const dbError = { message: 'boom', code: '50000' };
      const client = {
        from: vi.fn((table: string) =>
          table === failingTable
            ? makeQueryBuilder({ data: null, error: dbError })
            : makeQueryBuilder({ data: table === 'settings' ? null : [], error: null }),
        ),
      } as unknown as SupabaseClient;

      let caught: unknown;
      try {
        await loadFinanceData(client);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(Error);
      const err = caught as Error & { cause?: unknown };
      expect(err.message).toMatch(/[\u0E00-\u0E7F]/);
      expect(err.cause).toEqual(dbError);
    },
  );

  it('supports CRUD mutations with snake_case payloads and numeric strings', async () => {
    const builders: Record<string, ReturnType<typeof makeQueryBuilder>> = {
      settings: makeQueryBuilder({
        data: { user_id: 'u1', salary: '12000.00', pay_day: 15, budget_start_period: null },
        error: null,
      }),
      payment_sources: makeQueryBuilder({
        data: {
          id: 'src-new',
          name: 'บัตรใหม่',
          kind: 'credit_card',
          hue: 'lilac',
          archived: false,
          statement_close_day: 10,
          due_day: 24,
          due_month_offset: 0,
          pay_from_source_id: 'src-bank',
        },
        error: null,
      }),
      pots: makeQueryBuilder({
        data: { id: 'pot-new', name: 'ออม', per_period: '1500.50', rollover: true, hue: 'rose' },
        error: null,
      }),
      subscriptions: makeQueryBuilder({
        data: {
          id: 'sub-new',
          name: 'Spotify',
          amount: '139.00',
          frequency: 'monthly',
          billing_day: 5,
          billing_month: null,
          source_id: 'src-new',
          pot_id: 'pot-new',
          active: true,
        },
        error: null,
      }),
      installments: makeQueryBuilder({
        data: {
          id: 'inst-new',
          name: 'iPad',
          per_installment: '1381.93',
          count: 10,
          first_charge_date: '2026-11-01',
          source_id: 'src-new',
          pot_id: null,
        },
        error: null,
      }),
      transactions: makeQueryBuilder({
        data: {
          id: 'tx-new',
          date: '2026-11-15',
          amount: '85.50',
          direction: 'out',
          source_id: 'src-new',
          pot_id: 'pot-new',
          category: 'food',
          note: 'กาแฟ',
        },
        error: null,
      }),
    };

    const client = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })) },
      from: vi.fn((table: string) => builders[table]!),
      rpc: vi.fn(async () => ({ data: null, error: null })),
    } as unknown as SupabaseClient;

    const settings = await updateSettings({ salary: 1200000, payDay: 15 }, client);
    expect(settings).toEqual({ userId: 'u1', salary: 1200000, payDay: 15, budgetStartPeriod: null });
    expect(builders.settings.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', salary: '12000.00', pay_day: 15 },
      { onConflict: 'user_id' },
    );

    // budgetStartPeriod is written when provided (string or explicit null) and untouched when omitted (above).
    await updateSettings({ salary: 1200000, payDay: 15, budgetStartPeriod: '2026-11' }, client);
    expect(builders.settings.upsert).toHaveBeenLastCalledWith(
      { user_id: 'u1', salary: '12000.00', pay_day: 15, budget_start_period: '2026-11' },
      { onConflict: 'user_id' },
    );
    await updateSettings({ salary: 1200000, payDay: 15, budgetStartPeriod: null }, client);
    expect(builders.settings.upsert).toHaveBeenLastCalledWith(
      { user_id: 'u1', salary: '12000.00', pay_day: 15, budget_start_period: null },
      { onConflict: 'user_id' },
    );

    const src = await upsertSource(
      {
        name: 'บัตรใหม่',
        kind: 'credit_card',
        hue: 'lilac',
        archived: false,
        statementCloseDay: 10,
        dueDay: 24,
        dueMonthOffset: 0,
        payFromSourceId: 'src-bank',
      },
      client,
    );
    expect(src.id).toBe('src-new');
    await deleteSource('src-new', client);

    const pot = await upsertPot(
      { id: 'pot-new', name: 'ออม', perPeriod: 150050, rollover: true, hue: 'rose' },
      client,
    );
    expect(pot.perPeriod).toBe(150050);
    await deletePot('pot-new', client);

    const sub = await upsertSubscription(
      {
        name: 'Spotify',
        amount: 13900,
        frequency: 'monthly',
        billingDay: 5,
        billingMonth: null,
        sourceId: 'src-new',
        potId: 'pot-new',
        active: true,
      },
      client,
    );
    expect(sub.amount).toBe(13900);
    await deleteSubscription('sub-new', client);

    const inst = await upsertInstallment(
      {
        name: 'iPad',
        perInstallment: 138193,
        count: 10,
        firstChargeDate: '2026-11-01',
        sourceId: 'src-new',
        potId: null,
      },
      client,
    );
    expect(inst.perInstallment).toBe(138193);
    await deleteInstallment('inst-new', client);

    const tx = await createTransaction(
      {
        date: '2026-11-15',
        amount: 8550,
        direction: 'out',
        sourceId: 'src-new',
        potId: 'pot-new',
        category: 'food',
        note: 'กาแฟ',
      },
      client,
    );
    expect(tx.amount).toBe(8550);

    const updatedTx = await updateTransaction({ ...tx, note: 'ชา' }, client);
    expect(updatedTx.id).toBe('tx-new');
    await deleteTransaction('tx-new', client);

    await seedDefaults(client);
    expect(client.rpc).toHaveBeenCalledWith('seed_defaults');
  });

  it('payBill is idempotent when existing bill_payment matches sourceId + statementKey', async () => {
    const existingRow = {
      id: 'pay-existing',
      source_id: 'src-card',
      statement_key: '2026-11',
      amount: '1077.00',
      paid_on: '2026-11-24',
    };
    const builder = makeQueryBuilder({ data: existingRow, error: null });
    const client = {
      from: vi.fn(() => builder),
    } as unknown as SupabaseClient;

    const payment = await payBill(
      {
        sourceId: 'src-card',
        statementKey: '2026-11',
        amount: 107700,
        paidOn: '2026-11-24',
      },
      client,
    );

    expect(payment).toEqual({
      id: 'pay-existing',
      sourceId: 'src-card',
      statementKey: '2026-11',
      amount: 107700,
      paidOn: '2026-11-24',
      createdAt: '1970-01-01T00:00:00.000Z',
    });
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it('payBill handles concurrent unique violation (23505) idempotently by returning existing row', async () => {
    const existingRow = {
      id: 'pay-race',
      source_id: 'src-card',
      statement_key: '2026-11',
      amount: '1077.00',
      paid_on: '2026-11-24',
    };

    let call = 0;
    const client = {
      from: vi.fn(() => {
        call += 1;
        if (call === 1) {
          return makeQueryBuilder({ data: null, error: null });
        }
        if (call === 2) {
          return makeQueryBuilder({ data: null, error: { code: '23505', message: 'duplicate key' } });
        }
        return makeQueryBuilder({ data: existingRow, error: null });
      }),
    } as unknown as SupabaseClient;

    const payment = await payBill(
      {
        sourceId: 'src-card',
        statementKey: '2026-11',
        amount: 107700,
        paidOn: '2026-11-24',
      },
      client,
    );

    expect(payment.id).toBe('pay-race');
  });

  it('deleteBillPayment deletes a bill payment by id', async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    const client = {
      from: vi.fn(() => builder),
    } as unknown as SupabaseClient;

    await deleteBillPayment('pay-1', client);
    expect(client.from).toHaveBeenCalledWith('bill_payments');
    expect(builder.delete).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith('id', 'pay-1');
  });
});

describe('Phase 2 row <-> domain mappers round-trip', () => {
  it('round-trips transactions (including createdAt, recurringIncomeId, incomeDueOn) and bill_payments', () => {
    const sampleTx = {
      ...financeFixture.transactions[6]!,
      direction: 'in' as const,
      category: 'allowance' as const,
      recurringIncomeId: financeFixture.recurringIncomes[0]!.id,
      incomeDueOn: '2026-11-10',
    };
    const txRow = mapTransactionToRow(sampleTx);
    expect(txRow.created_at).toBe(sampleTx.createdAt);
    expect(txRow.recurring_income_id).toBe(sampleTx.recurringIncomeId);
    expect(txRow.income_due_on).toBe(sampleTx.incomeDueOn);
    expect(mapTransactionFromRow({ id: sampleTx.id, ...txRow })).toEqual(sampleTx);

    const samplePayment = financeFixture.payments[1]!;
    const payRow = mapBillPaymentToRow(samplePayment);
    expect(payRow.created_at).toBe(samplePayment.createdAt);
    expect(mapBillPaymentFromRow({ id: samplePayment.id, ...payRow })).toEqual(samplePayment);
  });

  it('round-trips balance_checks with null and non-null expectedBefore/adjustmentTxId', () => {
    const initCheck = financeFixture.balanceChecks[0]!;
    const initRow = mapBalanceCheckToRow(initCheck);
    expect(initRow).toEqual({
      source_id: initCheck.sourceId,
      checked_on: initCheck.checkedOn,
      actual: '5100.00',
      expected_before: null,
      adjustment_tx_id: null,
      created_at: initCheck.createdAt,
    });
    expect(mapBalanceCheckFromRow({ id: initCheck.id, ...initRow })).toEqual(initCheck);

    const adjCheck = {
      id: 'chk-2',
      sourceId: 'src-bank',
      checkedOn: '2026-11-15',
      actual: 450_000,
      expectedBefore: 463_500,
      adjustmentTxId: 'tx-adj',
      createdAt: '2026-11-15T10:00:00.000Z',
    };
    const adjRow = mapBalanceCheckToRow(adjCheck);
    expect(adjRow.expected_before).toBe('4635.00');
    expect(adjRow.adjustment_tx_id).toBe('tx-adj');
    expect(mapBalanceCheckFromRow({ id: adjCheck.id, ...adjRow })).toEqual(adjCheck);
  });

  it('round-trips plan_items for both pay and save kinds', () => {
    for (const item of financeFixture.planItems) {
      const row = mapPlanItemToRow(item);
      expect(mapPlanItemFromRow({ id: item.id, ...row })).toEqual(item);
    }
  });

  it('round-trips recurring_incomes', () => {
    for (const rec of financeFixture.recurringIncomes) {
      const row = mapRecurringIncomeToRow(rec);
      expect(mapRecurringIncomeFromRow({ id: rec.id, ...row })).toEqual(rec);
    }
  });
});

describe('Phase 2 financeRepo mutations and rollbacks', () => {
  it('createTransactions returns [] without querying Supabase when inputs is empty', async () => {
    const client = {
      from: vi.fn(),
    } as unknown as SupabaseClient;

    const result = await createTransactions([], client);
    expect(result).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('createTransactions inserts the entire batch in a single request', async () => {
    const rows = [
      {
        id: 'tx-b1',
        date: '2026-11-15',
        amount: '45.00',
        direction: 'out' as const,
        source_id: 'src-bank',
        pot_id: 'pot-essential',
        category: 'food' as const,
        note: 'ข้าวมันไก่',
        created_at: '2026-11-15T05:00:00.000Z',
        recurring_income_id: null,
        income_due_on: null,
      },
      {
        id: 'tx-b2',
        date: '2026-11-15',
        amount: '85.00',
        direction: 'out' as const,
        source_id: 'src-bank',
        pot_id: 'pot-essential',
        category: 'food' as const,
        note: 'ชานม',
        created_at: '2026-11-15T05:00:01.000Z',
        recurring_income_id: null,
        income_due_on: null,
      },
    ];
    const builder = makeQueryBuilder({ data: rows, error: null });
    const client = {
      from: vi.fn(() => builder),
    } as unknown as SupabaseClient;

    const created = await createTransactions(
      [
        {
          date: '2026-11-15',
          amount: 4_500,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'food',
          note: 'ข้าวมันไก่',
        },
        {
          date: '2026-11-15',
          amount: 8_500,
          direction: 'out',
          sourceId: 'src-bank',
          potId: 'pot-essential',
          category: 'food',
          note: 'ชานม',
        },
      ],
      client,
    );

    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith('transactions');
    expect(builder.insert).toHaveBeenCalledWith([
      {
        date: '2026-11-15',
        amount: '45.00',
        direction: 'out',
        source_id: 'src-bank',
        pot_id: 'pot-essential',
        category: 'food',
        note: 'ข้าวมันไก่',
      },
      {
        date: '2026-11-15',
        amount: '85.00',
        direction: 'out',
        source_id: 'src-bank',
        pot_id: 'pot-essential',
        category: 'food',
        note: 'ชานม',
      },
    ]);
    expect(created.map((t) => t.amount)).toEqual([4_500, 8_500]);
  });

  it('createBalanceCheck creates adjustment tx before check and links adjustmentTxId', async () => {
    const txBuilder = makeQueryBuilder({
      data: {
        id: 'tx-adj-1',
        date: '2026-11-15',
        amount: '135.00',
        direction: 'out',
        source_id: 'src-bank',
        pot_id: null,
        category: 'unknown',
        note: 'ส่วนต่างเช็กยอด',
        created_at: '2026-11-15T08:00:00.000Z',
        recurring_income_id: null,
        income_due_on: null,
      },
      error: null,
    });
    const checkBuilder = makeQueryBuilder({
      data: {
        id: 'chk-new',
        source_id: 'src-bank',
        checked_on: '2026-11-15',
        actual: '4500.00',
        expected_before: '4635.00',
        adjustment_tx_id: 'tx-adj-1',
        created_at: '2026-11-15T08:00:01.000Z',
      },
      error: null,
    });

    const callOrder: string[] = [];
    const client = {
      from: vi.fn((table: string) => {
        callOrder.push(table);
        return table === 'transactions' ? txBuilder : checkBuilder;
      }),
    } as unknown as SupabaseClient;

    const check = await createBalanceCheck(
      {
        sourceId: 'src-bank',
        checkedOn: '2026-11-15',
        actual: 450_000,
        expectedBefore: 463_500,
        adjustment: { amount: 13_500, direction: 'out' },
      },
      client,
    );

    expect(callOrder).toEqual(['transactions', 'balance_checks']);
    expect(txBuilder.insert).toHaveBeenCalledWith({
      date: '2026-11-15',
      amount: '135.00',
      direction: 'out',
      source_id: 'src-bank',
      pot_id: null,
      category: 'unknown',
      note: 'ส่วนต่างเช็กยอด',
    });
    expect(checkBuilder.insert).toHaveBeenCalledWith({
      source_id: 'src-bank',
      checked_on: '2026-11-15',
      actual: '4500.00',
      expected_before: '4635.00',
      adjustment_tx_id: 'tx-adj-1',
    });
    expect(check.adjustmentTxId).toBe('tx-adj-1');
  });

  it('createBalanceCheck rolls back the adjustment transaction when balance_checks insert fails', async () => {
    const txInsertBuilder = makeQueryBuilder({
      data: {
        id: 'tx-adj-rollback',
        date: '2026-11-15',
        amount: '135.00',
        direction: 'out',
        source_id: 'src-bank',
        pot_id: null,
        category: 'unknown',
        note: 'ส่วนต่างเช็กยอด',
        created_at: '2026-11-15T08:00:00.000Z',
        recurring_income_id: null,
        income_due_on: null,
      },
      error: null,
    });
    const txDeleteBuilder = makeQueryBuilder({ data: null, error: null });
    const checkFailBuilder = makeQueryBuilder({
      data: null,
      error: { message: 'db write error', code: '50000' },
    });

    let txCalls = 0;
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'transactions') {
          txCalls += 1;
          return txCalls === 1 ? txInsertBuilder : txDeleteBuilder;
        }
        return checkFailBuilder;
      }),
    } as unknown as SupabaseClient;

    await expect(
      createBalanceCheck(
        {
          sourceId: 'src-bank',
          checkedOn: '2026-11-15',
          actual: 450_000,
          expectedBefore: 463_500,
          adjustment: { amount: 13_500, direction: 'out' },
        },
        client,
      ),
    ).rejects.toThrow(/[\u0E00-\u0E7F]/);

    expect(txDeleteBuilder.delete).toHaveBeenCalledTimes(1);
    expect(txDeleteBuilder.eq).toHaveBeenCalledWith('id', 'tx-adj-rollback');
  });

  it('upsertPlanItem & deletePlanItem persist plan items with savings category enforced on save kind', async () => {
    const planBuilder = makeQueryBuilder({
      data: {
        id: 'plan-save',
        period_key: '2026-11',
        name: 'เก็บ',
        amount: '2000.00',
        kind: 'save',
        source_id: 'src-bank',
        due_on: '2026-11-28',
        category: 'savings',
        done_tx_id: null,
        sort_order: 2,
      },
      error: null,
    });
    const client = {
      from: vi.fn(() => planBuilder),
    } as unknown as SupabaseClient;

    const saved = await upsertPlanItem(
      {
        periodKey: '2026-11',
        name: 'เก็บ',
        amount: 200_000,
        kind: 'save',
        sourceId: 'src-bank',
        dueOn: '2026-11-28',
        category: 'other',
      },
      client,
    );
    expect(planBuilder.insert).toHaveBeenCalledWith({
      period_key: '2026-11',
      name: 'เก็บ',
      amount: '2000.00',
      kind: 'save',
      source_id: 'src-bank',
      due_on: '2026-11-28',
      category: 'savings',
    });
    expect(saved.category).toBe('savings');

    await deletePlanItem('plan-save', client);
    expect(planBuilder.delete).toHaveBeenCalledTimes(1);
    expect(planBuilder.eq).toHaveBeenCalledWith('id', 'plan-save');
  });

  it('completePlanItem creates tx out (savings for save, item.category for pay, potId null) and sets doneTxId; rolls back on update failure', async () => {
    const saveItemRow = {
      id: 'plan-save',
      period_key: '2026-11',
      name: 'เก็บ',
      amount: '2000.00',
      kind: 'save' as const,
      source_id: 'src-bank',
      due_on: '2026-11-28',
      category: 'savings' as const,
      done_tx_id: null,
      sort_order: 2,
    };

    const fetchPlanBuilder = makeQueryBuilder({ data: saveItemRow, error: null });
    const txInsertBuilder = makeQueryBuilder({
      data: {
        id: 'tx-plan-done',
        date: '2026-11-15',
        amount: '2000.00',
        direction: 'out',
        source_id: 'src-bank',
        pot_id: null,
        category: 'savings',
        note: 'เก็บ',
        created_at: '2026-11-15T10:00:00.000Z',
        recurring_income_id: null,
        income_due_on: null,
      },
      error: null,
    });
    const updatePlanBuilder = makeQueryBuilder({
      data: { ...saveItemRow, done_tx_id: 'tx-plan-done' },
      error: null,
    });

    let planCalls = 0;
    const okClient = {
      from: vi.fn((table: string) => {
        if (table === 'plan_items') {
          planCalls += 1;
          return planCalls === 1 ? fetchPlanBuilder : updatePlanBuilder;
        }
        return txInsertBuilder;
      }),
    } as unknown as SupabaseClient;

    const completed = await completePlanItem('plan-save', okClient);
    expect(completed.doneTxId).toBe('tx-plan-done');
    expect(txInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '2000.00',
        direction: 'out',
        source_id: 'src-bank',
        pot_id: null,
        category: 'savings',
        note: 'เก็บ',
      }),
    );
    expect(updatePlanBuilder.update).toHaveBeenCalledWith({ done_tx_id: 'tx-plan-done' });

    // Rollback case when updating plan_items fails after creating tx
    const txDeleteBuilder = makeQueryBuilder({ data: null, error: null });
    const failUpdateBuilder = makeQueryBuilder({ data: null, error: { message: 'update failed' } });
    let rbPlanCalls = 0;
    let rbTxCalls = 0;
    const rbClient = {
      from: vi.fn((table: string) => {
        if (table === 'plan_items') {
          rbPlanCalls += 1;
          return rbPlanCalls === 1 ? fetchPlanBuilder : failUpdateBuilder;
        }
        rbTxCalls += 1;
        return rbTxCalls === 1 ? txInsertBuilder : txDeleteBuilder;
      }),
    } as unknown as SupabaseClient;

    await expect(completePlanItem('plan-save', rbClient)).rejects.toThrow(/[\u0E00-\u0E7F]/);
    expect(txDeleteBuilder.delete).toHaveBeenCalledTimes(1);
    expect(txDeleteBuilder.eq).toHaveBeenCalledWith('id', 'tx-plan-done');

    // Pay kind uses item.category (bills) and potId null; already-done item is idempotent
    const payItemRow = {
      id: 'plan-dorm',
      period_key: '2026-11',
      name: 'ค่าหอ',
      amount: '1500.00',
      kind: 'pay' as const,
      source_id: 'src-bank',
      due_on: '2026-11-25',
      category: 'bills' as const,
      done_tx_id: null,
      sort_order: 1,
    };
    const fetchPayBuilder = makeQueryBuilder({ data: payItemRow, error: null });
    const payTxInsertBuilder = makeQueryBuilder({
      data: {
        id: 'tx-pay-done',
        date: '2026-11-15',
        amount: '1500.00',
        direction: 'out',
        source_id: 'src-bank',
        pot_id: null,
        category: 'bills',
        note: 'ค่าหอ',
        created_at: '2026-11-15T10:00:00.000Z',
        recurring_income_id: null,
        income_due_on: null,
      },
      error: null,
    });
    const updatePayBuilder = makeQueryBuilder({
      data: { ...payItemRow, done_tx_id: 'tx-pay-done' },
      error: null,
    });
    let payPlanCalls = 0;
    const payClient = {
      from: vi.fn((table: string) => {
        if (table === 'plan_items') {
          payPlanCalls += 1;
          return payPlanCalls === 1 ? fetchPayBuilder : updatePayBuilder;
        }
        return payTxInsertBuilder;
      }),
    } as unknown as SupabaseClient;

    const completedPay = await completePlanItem('plan-dorm', payClient);
    expect(completedPay.doneTxId).toBe('tx-pay-done');
    expect(payTxInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '1500.00',
        direction: 'out',
        source_id: 'src-bank',
        pot_id: null,
        category: 'bills',
        note: 'ค่าหอ',
      }),
    );

    const alreadyDoneClient = {
      from: vi.fn(() => makeQueryBuilder({ data: { ...payItemRow, done_tx_id: 'tx-pay-done' }, error: null })),
    } as unknown as SupabaseClient;
    const idempotent = await completePlanItem('plan-dorm', alreadyDoneClient);
    expect(idempotent.doneTxId).toBe('tx-pay-done');
    expect(alreadyDoneClient.from).toHaveBeenCalledTimes(1);
  });

  it('uncompletePlanItem deletes doneTxId transaction and clears done_tx_id to null', async () => {
    const doneItemRow = {
      id: 'plan-dorm',
      period_key: '2026-11',
      name: 'ค่าหอ',
      amount: '1500.00',
      kind: 'pay' as const,
      source_id: 'src-bank',
      due_on: '2026-11-25',
      category: 'bills' as const,
      done_tx_id: 'tx-dorm',
      sort_order: 1,
    };

    const fetchPlanBuilder = makeQueryBuilder({ data: doneItemRow, error: null });
    const txDeleteBuilder = makeQueryBuilder({ data: null, error: null });
    const updatePlanBuilder = makeQueryBuilder({
      data: { ...doneItemRow, done_tx_id: null },
      error: null,
    });

    let planCalls = 0;
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'plan_items') {
          planCalls += 1;
          return planCalls === 1 ? fetchPlanBuilder : updatePlanBuilder;
        }
        return txDeleteBuilder;
      }),
    } as unknown as SupabaseClient;

    const uncompleted = await uncompletePlanItem('plan-dorm', client);
    expect(txDeleteBuilder.delete).toHaveBeenCalledTimes(1);
    expect(txDeleteBuilder.eq).toHaveBeenCalledWith('id', 'tx-dorm');
    expect(updatePlanBuilder.update).toHaveBeenCalledWith({ done_tx_id: null });
    expect(uncompleted.doneTxId).toBeNull();
  });

  it('upsertRecurringIncome, deleteRecurringIncome, and confirmIncome create allowance income tx', async () => {
    const recRow = {
      id: 'inc-mom-10',
      name: 'เงินจากแม่',
      amount: '5100.00',
      day_of_month: 10,
      source_id: 'src-bank',
      active: true,
    };
    const recBuilder = makeQueryBuilder({ data: recRow, error: null });
    const txBuilder = makeQueryBuilder({
      data: {
        id: 'tx-income-1',
        date: '2026-11-10',
        amount: '5100.00',
        direction: 'in',
        source_id: 'src-bank',
        pot_id: null,
        category: 'allowance',
        note: 'เงินจากแม่',
        created_at: '2026-11-10T07:00:00.000Z',
        recurring_income_id: 'inc-mom-10',
        income_due_on: '2026-11-10',
      },
      error: null,
    });

    const client = {
      from: vi.fn((table: string) => (table === 'recurring_incomes' ? recBuilder : txBuilder)),
    } as unknown as SupabaseClient;

    const rec = await upsertRecurringIncome(
      { name: 'เงินจากแม่', amount: 510_000, dayOfMonth: 10, sourceId: 'src-bank', active: true },
      client,
    );
    expect(rec.id).toBe('inc-mom-10');

    const tx = await confirmIncome(
      {
        recurringIncomeId: 'inc-mom-10',
        incomeDueOn: '2026-11-10',
        amount: 510_000,
        date: '2026-11-10',
      },
      client,
    );
    expect(txBuilder.insert).toHaveBeenCalledWith({
      date: '2026-11-10',
      amount: '5100.00',
      direction: 'in',
      source_id: 'src-bank',
      pot_id: null,
      category: 'allowance',
      note: 'เงินจากแม่',
      recurring_income_id: 'inc-mom-10',
      income_due_on: '2026-11-10',
    });
    expect(tx.category).toBe('allowance');
    expect(tx.direction).toBe('in');

    await deleteRecurringIncome('inc-mom-10', client);
    expect(recBuilder.delete).toHaveBeenCalledTimes(1);
    expect(recBuilder.eq).toHaveBeenCalledWith('id', 'inc-mom-10');
  });

  it('clearAllData({ includeSetup: false }) deletes only data tables in FK-safe child-first order', async () => {
    const ops: string[] = [];
    const eqCalls: Array<{ table: string; col: string; val: unknown }> = [];
    const rpcSpy = vi.fn(async () => ({ error: null }));

    const client = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      rpc: rpcSpy,
      from: vi.fn((table: string) => {
        const builder: Record<string, unknown> = {
          delete: vi.fn(() => {
            ops.push(`delete:${table}`);
            return builder;
          }),
          eq: vi.fn((col: string, val: unknown) => {
            eqCalls.push({ table, col, val });
            return builder;
          }),
          then: (onFulfilled: (v: QueryResult) => unknown, onRejected?: (r: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    await clearAllData({ includeSetup: false }, client);

    expect(ops).toEqual([
      'delete:balance_checks',
      'delete:plan_items',
      'delete:transactions',
      'delete:bill_payments',
      'delete:subscriptions',
      'delete:installments',
    ]);
    expect(eqCalls).toEqual([
      { table: 'balance_checks', col: 'user_id', val: 'user-1' },
      { table: 'plan_items', col: 'user_id', val: 'user-1' },
      { table: 'transactions', col: 'user_id', val: 'user-1' },
      { table: 'bill_payments', col: 'user_id', val: 'user-1' },
      { table: 'subscriptions', col: 'user_id', val: 'user-1' },
      { table: 'installments', col: 'user_id', val: 'user-1' },
    ]);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('clearAllData({ includeSetup: true }) deletes data + setup tables in order, resets settings, and runs seed_defaults', async () => {
    const ops: string[] = [];
    const rpcSpy = vi.fn(async (fn: string) => {
      ops.push(`rpc:${fn}`);
      return { error: null };
    });
    let settingsUpsertPayload: unknown = null;

    const client = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      rpc: rpcSpy,
      from: vi.fn((table: string) => {
        const settingsResult: QueryResult = {
          data: { user_id: 'user-1', salary: '10200.00', pay_day: 10, budget_start_period: null },
          error: null,
        };
        const builder: Record<string, unknown> = {
          delete: vi.fn(() => {
            ops.push(`delete:${table}`);
            return builder;
          }),
          upsert: vi.fn((payload: unknown) => {
            ops.push(`upsert:${table}`);
            settingsUpsertPayload = payload;
            return builder;
          }),
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          single: vi.fn(async () => settingsResult),
          then: (onFulfilled: (v: QueryResult) => unknown, onRejected?: (r: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    await clearAllData({ includeSetup: true }, client);

    expect(ops).toEqual([
      'delete:balance_checks',
      'delete:plan_items',
      'delete:transactions',
      'delete:bill_payments',
      'delete:subscriptions',
      'delete:installments',
      'delete:recurring_incomes',
      'delete:pots',
      'delete:payment_sources',
      'upsert:settings',
      'rpc:seed_defaults',
    ]);
    expect(settingsUpsertPayload).toEqual({
      user_id: 'user-1',
      salary: '10200.00',
      pay_day: 10,
      budget_start_period: null,
    });
  });

  it('clearAllData stops and throws Thai error if a table delete fails mid-way or user is unauthenticated', async () => {
    const ops: string[] = [];
    const client = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      rpc: vi.fn(),
      from: vi.fn((table: string) => {
        const builder: Record<string, unknown> = {
          delete: vi.fn(() => {
            ops.push(table);
            return builder;
          }),
          eq: vi.fn(() => builder),
          then: (onFulfilled: (v: QueryResult) => unknown, onRejected?: (r: unknown) => unknown) =>
            Promise.resolve(
              table === 'transactions' ? { data: null, error: { message: 'db failure' } } : { data: null, error: null },
            ).then(onFulfilled, onRejected),
        };
        return builder;
      }),
    } as unknown as SupabaseClient;

    await expect(clearAllData({ includeSetup: true }, client)).rejects.toThrow(/ล้างข้อมูลไม่สำเร็จ/);
    expect(ops).toEqual(['balance_checks', 'plan_items', 'transactions']);

    const unauthClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
      from: vi.fn(),
    } as unknown as SupabaseClient;
    await expect(clearAllData({ includeSetup: false }, unauthClient)).rejects.toThrow(/เข้าสู่ระบบ/);
  });
});
