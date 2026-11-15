import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createTransaction,
  deleteBillPayment,
  deleteInstallment,
  deletePot,
  deleteSource,
  deleteSubscription,
  deleteTransaction,
  loadFinanceData,
  mapBillPaymentFromRow,
  mapInstallmentFromRow,
  mapPotFromRow,
  mapSettingsFromRow,
  mapSourceFromRow,
  mapSubscriptionFromRow,
  mapTransactionFromRow,
  numericToSatang,
  payBill,
  satangToNumeric,
  seedDefaults,
  updateSettings,
  updateTransaction,
  upsertInstallment,
  upsertPot,
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
