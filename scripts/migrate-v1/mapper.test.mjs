import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applyMigration,
  formatDryRunReport,
  mapV1CsvSet,
  parseCsv,
  parseMoneyToSatang,
  resolveAirpodsFirstDate,
  satangToNumeric,
  toBangkokDate,
} from './mapper.mjs';
import { parseCliArgs } from './migrate.mjs';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');

function readFixture(name) {
  return readFileSync(join(fixturesDir, name), 'utf8');
}

describe('parseCsv', () => {
  it('parses UTF-8 BOM, CRLF, quoted commas, escaped quotes, and multiline notes', () => {
    const csv = '\uFEFFid,name,note\r\n1,หนัง,"ดูหนัง, ""IMAX""\nรอบดึก"\r\n2,กาแฟ,\r\n';
    expect(parseCsv(csv)).toEqual([
      { id: '1', name: 'หนัง', note: 'ดูหนัง, "IMAX"\nรอบดึก' },
      { id: '2', name: 'กาแฟ', note: '' },
    ]);
  });

  it('returns empty array for header-only or empty CSV', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('id,name,amount\n')).toEqual([]);
  });
});

describe('toBangkokDate & money helpers', () => {
  it('converts UTC postgres timestamptz to Asia/Bangkok calendar date', () => {
    // 18:30 UTC is 01:30 next day in UTC+7.
    expect(toBangkokDate('2026-11-12 18:30:00+00')).toBe('2026-11-13');
    expect(toBangkokDate('2025-10-31 18:30:00+00')).toBe('2025-11-01');
    expect(toBangkokDate('2026-11-10T04:00:00.000Z')).toBe('2026-11-10');
    expect(toBangkokDate('2026-09-01')).toBe('2026-09-01');
  });

  it('converts decimal strings to integer satang and back without float drift', () => {
    expect(parseMoneyToSatang('1381.93')).toBe(138193);
    expect(parseMoneyToSatang('10,200.00')).toBe(1020000);
    expect(satangToNumeric(138193)).toBe('1381.93');
    expect(satangToNumeric(1020000)).toBe('10200.00');
  });

  it('resolves YYYY-MM-DD and YYYY-MM airpods-first values with day clamping', () => {
    expect(resolveAirpodsFirstDate('2026-09-01', 15)).toBe('2026-09-01');
    expect(resolveAirpodsFirstDate('2026-02', 31)).toBe('2026-02-28');
    expect(resolveAirpodsFirstDate('2026-09', 1)).toBe('2026-09-01');
  });
});

describe('mapV1CsvSet with __fixtures__', () => {
  it('maps subscriptions, AirPods installment, budget_entries, transfer_entries, and budget_settings', () => {
    const result = mapV1CsvSet(
      {
        subscriptions: readFixture('subscriptions.csv'),
        budget_settings: readFixture('budget_settings.csv'),
        budget_entries: readFixture('budget_entries.csv'),
        transfer_entries: readFixture('transfer_entries.csv'),
      },
      {
        airpodsCount: 10,
        airpodsFirst: '2026-09-01',
        userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    );

    expect(result.settings).toEqual({ salarySatang: 1_020_000 });

    // 4 normal subscriptions on credit_card + pot ใช้ตามใจ (1Password yearly infers month 11 in Bangkok TZ)
    expect(result.subscriptions).toHaveLength(4);
    expect(result.subscriptions.map((s) => s.name)).toEqual([
      'Claude',
      'Gemini + YouTube',
      'iCloud',
      '1Password',
    ]);
    expect(result.subscriptions[0]).toMatchObject({
      name: 'Claude',
      amountSatang: 69_900,
      frequency: 'monthly',
      billingDay: 1,
      billingMonth: null,
      sourceKind: 'credit_card',
      potName: 'ใช้ตามใจ',
      active: true,
    });
    expect(result.subscriptions[3]).toMatchObject({
      name: '1Password',
      amountSatang: 120_000,
      frequency: 'yearly',
      billingDay: 15,
      billingMonth: 11,
      sourceKind: 'credit_card',
      potName: 'ใช้ตามใจ',
    });

    // AirPods moved to SPayLater Installment
    expect(result.installments).toHaveLength(1);
    expect(result.installments[0]).toMatchObject({
      name: 'AirPods',
      perInstallmentSatang: 138_193,
      count: 10,
      firstChargeDate: '2026-09-01',
      sourceKind: 'paylater',
      potName: 'ใช้ตามใจ',
    });

    // 4 budget_entries (out) + 1 incoming transfer_entries (in); 1 outgoing transfer skipped
    expect(result.transactions).toHaveLength(5);

    const cashFood = result.transactions.find((t) => t.v1Key === '33333333-3333-4333-8333-333333333301');
    expect(cashFood).toMatchObject({
      date: '2026-11-13', // shifted from 2026-11-12 18:30+00 to Bangkok
      amountSatang: 8_500,
      direction: 'out',
      sourceKind: 'bank',
      potName: 'ใช้จ่ายจำเป็น', // cash = everyday spending, must not eat the discretionary pot
      category: 'food',
    });
    expect(cashFood.note).toContain('ชานม');
    expect(cashFood.note).toContain('[v1:budget:33333333-3333-4333-8333-333333333301]');

    const cardMovie = result.transactions.find((t) => t.v1Key === '33333333-3333-4333-8333-333333333302');
    expect(cardMovie).toMatchObject({
      date: '2026-11-11',
      amountSatang: 22_000,
      direction: 'out',
      sourceKind: 'credit_card',
      potName: 'ใช้ตามใจ',
      category: 'entertainment',
    });
    expect(cardMovie.note).toContain('หนัง — ดูหนัง, ซื้อป๊อปคอร์น "IMAX"');

    const incomingTransfer = result.transactions.find(
      (t) => t.v1Key === '44444444-4444-4444-8444-444444444401',
    );
    expect(incomingTransfer).toMatchObject({
      date: '2026-11-10',
      amountSatang: 150_000,
      direction: 'in',
      sourceKind: 'bank',
      potName: null,
      category: 'other',
    });
    expect(incomingTransfer.note).toContain('แม่โอนให้ — ค่าขนม');
    expect(incomingTransfer.note).toContain('[v1:transfer:44444444-4444-4444-8444-444444444401]');

    // Before/after summary totals
    expect(result.summary.before.subscriptions).toEqual({ count: 5, totalSatang: 365_893 });
    expect(result.summary.before.budgetEntries).toEqual({ count: 4, totalSatang: 70_250 });
    expect(result.summary.before.transferEntries).toEqual({
      count: 2,
      incomingCount: 1,
      incomingSatang: 150_000,
      outgoingCount: 1,
      outgoingSatang: 20_000,
    });

    expect(result.summary.after.subscriptions).toEqual({ count: 4, totalSatang: 227_700 });
    expect(result.summary.after.installments).toEqual({
      count: 1,
      perInstallmentTotalSatang: 138_193,
    });
    expect(result.summary.after.transactionsOut).toEqual({ count: 4, totalSatang: 70_250 });
    expect(result.summary.after.transactionsIn).toEqual({ count: 1, totalSatang: 150_000 });
    expect(result.summary.skipped.outgoingTransfers).toEqual({ count: 1, totalSatang: 20_000 });
    // cash 85.00 + 47.50 -> ใช้จ่ายจำเป็น · card 220.00 + 350.00 -> ใช้ตามใจ
    expect(result.summary.after.transactionsOutByPot).toEqual({
      ใช้จ่ายจำเป็น: { count: 2, totalSatang: 13_250 },
      ใช้ตามใจ: { count: 2, totalSatang: 57_000 },
    });

    const report = formatDryRunReport(result);
    expect(report).toContain('DRY-RUN');
    expect(report).toContain('subscriptions');
    expect(report).toContain('installments');
    expect(report).toContain('10,200.00');
    expect(report).toMatch(/pot ใช้จ่ายจำเป็น .*2 แถว \| รวม = 132\.50/);
    expect(report).toMatch(/pot ใช้ตามใจ .*2 แถว \| รวม = 570\.00/);
  });

  it('routes cash to bank + ใช้จ่ายจำเป็น and card to credit_card + ใช้ตามใจ', () => {
    const result = mapV1CsvSet(
      {
        subscriptions: '',
        budget_settings: '',
        budget_entries: readFixture('budget_entries.csv'),
        transfer_entries: '',
      },
      { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    );

    const outs = result.transactions.filter((t) => t.direction === 'out');
    expect(outs).toHaveLength(4);
    for (const tx of outs) {
      const key = `${tx.sourceKind}/${tx.potName}`;
      expect(['bank/ใช้จ่ายจำเป็น', 'credit_card/ใช้ตามใจ']).toContain(key);
    }
    expect(outs.filter((t) => t.sourceKind === 'bank')).toHaveLength(2);
    expect(outs.filter((t) => t.sourceKind === 'credit_card')).toHaveLength(2);
  });

  it('produces deterministic IDs and markers even without id column in CSV', () => {
    const csvNoId = {
      subscriptions: 'name,price,frequency,billing_day,notify_days_before\nSpotify,129,monthly,5,3\n',
      budget_settings: 'monthly_income\n12000\n',
      budget_entries: 'name,amount,payment_type,category,entry_date,note\nกาแฟ,60,cash,food,2026-11-10,เช้า\n',
      transfer_entries: '',
    };

    const run1 = mapV1CsvSet(csvNoId, { userId: 'user-1' });
    const run2 = mapV1CsvSet(csvNoId, { userId: 'user-1' });
    expect(run1.subscriptions[0].id).toBe(run2.subscriptions[0].id);
    expect(run1.transactions[0].id).toBe(run2.transactions[0].id);
    expect(run1.transactions[0].marker).toBe(run2.transactions[0].marker);
  });

  it('skips overwriting settings.salary when v1 monthly_income is 0', () => {
    const res = mapV1CsvSet({
      subscriptions: '',
      budget_settings: 'monthly_income\n0\n',
      budget_entries: '',
      transfer_entries: '',
    });
    expect(res.settings).toBeNull();
    expect(res.warnings.some((w) => w.includes('monthly_income'))).toBe(true);
  });

  it('throws if AirPods subscription is present without airpodsCount or airpodsFirst', () => {
    expect(() =>
      mapV1CsvSet(
        {
          subscriptions: readFixture('subscriptions.csv'),
          budget_settings: '',
          budget_entries: '',
          transfer_entries: '',
        },
        {},
      ),
    ).toThrow(/airpods/i);
  });
});

function createFakeSupabaseClient(userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') {
  const db = {
    settings: [{ user_id: userId, salary: '10200.00', pay_day: 10 }],
    payment_sources: [
      { id: 'src-bank', user_id: userId, name: 'บัญชี', kind: 'bank' },
      { id: 'src-card', user_id: userId, name: 'บัตรเครดิต', kind: 'credit_card' },
      { id: 'src-spay', user_id: userId, name: 'SPayLater', kind: 'paylater' },
    ],
    pots: [
      { id: 'pot-play', user_id: userId, name: 'ใช้ตามใจ' },
      { id: 'pot-ess', user_id: userId, name: 'ใช้จ่ายจำเป็น' },
    ],
    subscriptions: [],
    installments: [],
    transactions: [],
  };

  function makeQuery(table) {
    let op = 'select';
    let payload = null;
    let filters = [];

    const builder = {
      select() {
        return builder;
      },
      order() {
        return builder;
      },
      range(from, to) {
        const rows = db[table]
          .filter((row) => filters.every(([k, v]) => row[k] === v))
          .slice(from, to + 1);
        return Promise.resolve({ data: rows, error: null });
      },
      eq(col, val) {
        filters.push([col, val]);
        return builder;
      },
      maybeSingle() {
        const rows = db[table].filter((row) => filters.every(([k, v]) => row[k] === v));
        return Promise.resolve({ data: rows[0] ?? null, error: null });
      },
      insert(rows) {
        op = 'insert';
        payload = Array.isArray(rows) ? rows : [rows];
        return builder;
      },
      upsert(rows) {
        op = 'upsert';
        payload = Array.isArray(rows) ? rows : [rows];
        return builder;
      },
      then(resolve) {
        if (op === 'insert') {
          const inserted = payload.map((r) => ({ ...r, user_id: r.user_id ?? userId }));
          for (const row of inserted) {
            if (db[table].some((e) => e.id === row.id)) {
              return resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
            }
          }
          db[table].push(...inserted);
          return resolve({ data: inserted, error: null });
        }
        if (op === 'upsert') {
          for (const row of payload) {
            const idx = db[table].findIndex((e) => e.user_id === (row.user_id ?? userId));
            if (idx >= 0) db[table][idx] = { ...db[table][idx], ...row };
            else db[table].push({ ...row, user_id: row.user_id ?? userId });
          }
          return resolve({ data: payload, error: null });
        }
        const rows = db[table].filter((row) => filters.every(([k, v]) => row[k] === v));
        return resolve({ data: rows, error: null });
      },
    };
    return builder;
  }

  return {
    db,
    rpc: async () => ({ data: null, error: null }),
    from: (table) => makeQuery(table),
  };
}

describe('applyMigration idempotency', () => {
  it('inserts all mapped rows on first apply and inserts 0 duplicates on re-run', async () => {
    const client = createFakeSupabaseClient();
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const mapped = mapV1CsvSet(
      {
        subscriptions: readFixture('subscriptions.csv'),
        budget_settings: readFixture('budget_settings.csv'),
        budget_entries: readFixture('budget_entries.csv'),
        transfer_entries: readFixture('transfer_entries.csv'),
      },
      {
        airpodsCount: 10,
        airpodsFirst: '2026-09-01',
        userId,
      },
    );

    const first = await applyMigration(mapped, client, userId);
    expect(first.inserted).toEqual({
      subscriptions: 4,
      installments: 1,
      transactions: 5,
    });
    expect(first.skipped).toEqual({
      subscriptions: 0,
      installments: 0,
      transactions: 0,
    });
    expect(client.db.subscriptions).toHaveLength(4);
    expect(client.db.installments).toHaveLength(1);
    expect(client.db.transactions).toHaveLength(5);

    // Pot split lands in the database: cash -> pot-ess on the bank, card -> pot-play on the card.
    const outs = client.db.transactions.filter((t) => t.direction === 'out');
    expect(outs.filter((t) => t.source_id === 'src-bank').every((t) => t.pot_id === 'pot-ess')).toBe(true);
    expect(outs.filter((t) => t.source_id === 'src-card').every((t) => t.pot_id === 'pot-play')).toBe(true);
    expect(outs.filter((t) => t.pot_id === 'pot-ess')).toHaveLength(2);
    expect(outs.filter((t) => t.pot_id === 'pot-play')).toHaveLength(2);
    expect(client.db.transactions.find((t) => t.direction === 'in').pot_id).toBeNull();

    // Re-run with the exact same CSVs — must not insert any duplicates.
    const second = await applyMigration(mapped, client, userId);
    expect(second.inserted).toEqual({
      subscriptions: 0,
      installments: 0,
      transactions: 0,
    });
    expect(second.skipped).toEqual({
      subscriptions: 4,
      installments: 1,
      transactions: 5,
    });
    expect(client.db.subscriptions).toHaveLength(4);
    expect(client.db.installments).toHaveLength(1);
    expect(client.db.transactions).toHaveLength(5);
  });

  it('also skips transactions matched by note marker even when existing row has a random UUID', async () => {
    const client = createFakeSupabaseClient();
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    client.db.transactions.push({
      id: '99999999-9999-4999-8999-999999999999',
      user_id: userId,
      date: '2026-11-13',
      amount: '85.00',
      direction: 'out',
      source_id: 'src-bank',
      pot_id: 'pot-play',
      category: 'food',
      note: 'ชานม [v1:budget:33333333-3333-4333-8333-333333333301]',
    });

    const mapped = mapV1CsvSet(
      {
        subscriptions: '',
        budget_settings: '',
        budget_entries: readFixture('budget_entries.csv'),
        transfer_entries: '',
      },
      { userId },
    );

    const res = await applyMigration(mapped, client, userId);
    expect(res.inserted.transactions).toBe(3);
    expect(res.skipped.transactions).toBe(1);
    expect(client.db.transactions).toHaveLength(4);
  });

  it('throws a clear Thai error when a required pot is missing', async () => {
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const mapped = mapV1CsvSet(
      { subscriptions: '', budget_settings: '', budget_entries: readFixture('budget_entries.csv'), transfer_entries: '' },
      { userId },
    );

    const noEssential = createFakeSupabaseClient();
    noEssential.db.pots = noEssential.db.pots.filter((p) => p.name !== 'ใช้จ่ายจำเป็น');
    await expect(applyMigration(mapped, noEssential, userId)).rejects.toThrow('ไม่พบ pot ชื่อ "ใช้จ่ายจำเป็น"');

    const noPlay = createFakeSupabaseClient();
    noPlay.db.pots = noPlay.db.pots.filter((p) => p.name !== 'ใช้ตามใจ');
    await expect(applyMigration(mapped, noPlay, userId)).rejects.toThrow('ไม่พบ pot ชื่อ "ใช้ตามใจ"');
  });

  it('updates settings.salary when changed and reports unchanged on repeat apply', async () => {
    const client = createFakeSupabaseClient();
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const mapped = mapV1CsvSet(
      {
        subscriptions: '',
        budget_settings: 'monthly_income\n12500.50\n',
        budget_entries: '',
        transfer_entries: '',
      },
      { userId },
    );

    const first = await applyMigration(mapped, client, userId);
    expect(first.settingsAction).toBe('updated');
    expect(client.db.settings[0].salary).toBe('12500.50');

    const second = await applyMigration(mapped, client, userId);
    expect(second.settingsAction).toBe('unchanged');
  });
});

describe('parseCliArgs', () => {
  it('defaults to dry-run and parses flags cleanly', () => {
    expect(parseCliArgs([])).toMatchObject({ apply: false, help: false });
    expect(
      parseCliArgs(['--apply', '--airpods-count', '10', '--airpods-first=2026-09-01']),
    ).toMatchObject({
      apply: true,
      airpodsCount: '10',
      airpodsFirst: '2026-09-01',
    });
  });

  it('rejects unknown flags', () => {
    expect(() => parseCliArgs(['--unknown'])).toThrow(/--unknown/);
  });
});
