import { createHash } from 'node:crypto';

const VALID_CATEGORIES = new Set([
  'food',
  'transport',
  'shopping',
  'entertainment',
  'health',
  'bills',
  'other',
]);

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/;
const PG_TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)([+-]\d{2}(?::?\d{2})?|Z)?$/i;

const BANGKOK_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Parse RFC-4180 CSV exported from Supabase Table Editor.
 * Handles UTF-8 BOM, CRLF/LF, quoted fields, escaped quotes, and multiline values.
 */
export function parseCsv(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '');
  if (clean.trim() === '') return [];

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (clean[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (inQuotes) {
    throw new Error('CSV รูปแบบไม่ถูกต้อง: พบเครื่องหมายคำพูด (") ที่ยังไม่ปิด');
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length <= 1) return [];

  const headers = rows[0].map((h) => h.trim());
  const records = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    // Skip trailing blank lines that often appear at the end of CSV exports.
    if (cells.length === 1 && cells[0].trim() === '') continue;

    const record = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (!header) continue;
      record[header] = cells[c] ?? '';
    }
    records.push(record);
  }

  return records;
}

function isValidCalendarDate(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Convert a v1 date or Postgres timestamptz string into a YYYY-MM-DD calendar date in Asia/Bangkok.
 */
export function toBangkokDate(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    throw new Error('พบแถวที่ไม่มีวันที่');
  }

  const dateOnly = ISO_DATE_RE.exec(trimmed);
  if (dateOnly) {
    const y = Number(dateOnly[1]);
    const m = Number(dateOnly[2]);
    const d = Number(dateOnly[3]);
    if (!isValidCalendarDate(y, m, d)) {
      throw new Error(`วันที่ไม่ถูกต้อง: ${trimmed}`);
    }
    return trimmed;
  }

  let normalized = trimmed;
  const pgMatch = PG_TIMESTAMP_RE.exec(trimmed);
  if (pgMatch) {
    let tz = pgMatch[3] ?? 'Z';
    if (/^[+-]\d{2}$/.test(tz)) tz = `${tz}:00`;
    else if (/^[+-]\d{4}$/.test(tz)) tz = `${tz.slice(0, 3)}:${tz.slice(3)}`;
    normalized = `${pgMatch[1]}T${pgMatch[2]}${tz}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`ไม่สามารถแปลงวันที่ได้: ${trimmed}`);
  }

  return BANGKOK_FORMATTER.format(parsed);
}

export function parseMoneyToSatang(raw, { allowZero = false } = {}) {
  const cleaned = String(raw ?? '').replace(/,/g, '').trim();
  if (!cleaned) {
    throw new Error('พบจำนวนเงินว่าง');
  }
  const num = Number(cleaned);
  if (!Number.isFinite(num)) {
    throw new Error(`จำนวนเงินไม่ถูกต้อง: ${raw}`);
  }
  const satang = Math.round(num * 100);
  if (!Number.isSafeInteger(satang)) {
    throw new Error(`จำนวนเงินเกินขอบเขต: ${raw}`);
  }
  if (allowZero ? satang < 0 : satang <= 0) {
    throw new Error(`จำนวนเงินต้อง${allowZero ? 'ไม่ติดลบ' : 'มากกว่า 0'}: ${raw}`);
  }
  return satang;
}

export function satangToNumeric(satang) {
  const rounded = Math.round(satang);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const baht = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${sign}${baht}.${String(cents).padStart(2, '0')}`;
}

export function formatBaht(satang) {
  const baht = satang / 100;
  return baht.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Resolve --airpods-first accepting either YYYY-MM-DD or YYYY-MM (using billingDay clamped to the month).
 */
export function resolveAirpodsFirstDate(raw, billingDay = 1) {
  const trimmed = String(raw ?? '').trim();
  const full = ISO_DATE_RE.exec(trimmed);
  if (full) {
    const y = Number(full[1]);
    const m = Number(full[2]);
    const d = Number(full[3]);
    if (!isValidCalendarDate(y, m, d)) {
      throw new Error(`วันที่งวดแรกของ AirPods ไม่ถูกต้อง: ${trimmed}`);
    }
    return trimmed;
  }

  const ym = YEAR_MONTH_RE.exec(trimmed);
  if (ym) {
    const y = Number(ym[1]);
    const m = Number(ym[2]);
    if (m < 1 || m > 12) {
      throw new Error(`เดือนงวดแรกของ AirPods ไม่ถูกต้อง: ${trimmed}`);
    }
    const clamped = Math.min(Math.max(1, Math.trunc(billingDay || 1)), daysInMonth(y, m));
    return `${ym[1]}-${ym[2]}-${String(clamped).padStart(2, '0')}`;
  }

  throw new Error(`รูปแบบวันที่งวดแรกต้องเป็น YYYY-MM-DD หรือ YYYY-MM (ได้รับ: ${trimmed})`);
}

/**
 * Derive a deterministic UUID scoped to the user and source record so re-running migration is idempotent.
 */
export function deterministicUuid(...parts) {
  const buf = createHash('sha256').update(parts.join('\0')).digest();
  // Set RFC 4122 version 4 and variant bits so Postgres uuid columns accept the value.
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = buf.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildV1Key(tableName, row, seenFingerprints) {
  const rawId = String(row.id ?? '').trim();
  if (rawId) return rawId;

  const canonical = Object.keys(row)
    .sort()
    .map((k) => `${k}=${String(row[k] ?? '').trim()}`)
    .join('|');
  const baseHash = createHash('sha256').update(`${tableName}\0${canonical}`).digest('hex').slice(0, 12);
  const count = (seenFingerprints.get(baseHash) ?? 0) + 1;
  seenFingerprints.set(baseHash, count);
  return `${baseHash}-${count}`;
}

function formatTransactionNote(name, rawNote, marker) {
  const cleanName = String(name ?? '').trim();
  const cleanNote = String(rawNote ?? '').trim();
  let body = cleanName;
  if (cleanNote && cleanNote !== cleanName) {
    body = cleanName ? `${cleanName} — ${cleanNote}` : cleanNote;
  }
  return body ? `${body} ${marker}` : marker;
}

export function isAirpodsName(name) {
  return /airpod/i.test(String(name ?? ''));
}

export function hasAirpodsSubscription(csvText) {
  const rows = parseCsv(csvText);
  return rows.some((r) => isAirpodsName(r.name));
}

function parseBillingDay(raw) {
  const day = Number(String(raw ?? '').trim());
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`billing_day ไม่ถูกต้อง (ต้องเป็น 1-31): ${raw}`);
  }
  return day;
}

/**
 * Pure mapper from the 4 v1 CSV strings into v2 domain records and a before/after summary.
 */
export function mapV1CsvSet(csvTexts, options = {}) {
  const userScope = options.userId || 'dry-run-user';
  const warnings = [];
  const seenFingerprints = new Map();

  const subRows = parseCsv(csvTexts.subscriptions ?? '');
  const settingsRows = parseCsv(csvTexts.budget_settings ?? '');
  const budgetRows = parseCsv(csvTexts.budget_entries ?? '');
  const transferRows = parseCsv(csvTexts.transfer_entries ?? '');

  const hasAirpods = subRows.some((r) => isAirpodsName(r.name));
  let airpodsCount = null;
  if (hasAirpods) {
    const parsedCount = Number(options.airpodsCount);
    if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
      throw new Error(
        'พบรายการ AirPods ใน subscriptions.csv — กรุณาระบุจำนวนงวดด้วย --airpods-count <จำนวนงวด> และ --airpods-first <YYYY-MM-DD>',
      );
    }
    if (!options.airpodsFirst) {
      throw new Error(
        'พบรายการ AirPods ใน subscriptions.csv — กรุณาระบุงวดแรกด้วย --airpods-first <YYYY-MM-DD>',
      );
    }
    airpodsCount = parsedCount;
  }

  // 1. Map budget_settings.monthly_income -> settings.salary
  let mappedSettings = null;
  let beforeMonthlyIncomeSatang = 0;
  if (settingsRows.length > 0) {
    if (settingsRows.length > 1) {
      warnings.push(`budget_settings มี ${settingsRows.length} แถว — ใช้แถวแรกในการย้าย monthly_income`);
    }
    const rawIncome = settingsRows[0].monthly_income;
    if (rawIncome !== undefined && String(rawIncome).trim() !== '') {
      beforeMonthlyIncomeSatang = parseMoneyToSatang(rawIncome, { allowZero: true });
      if (beforeMonthlyIncomeSatang > 0) {
        mappedSettings = { salarySatang: beforeMonthlyIncomeSatang };
      } else {
        // Avoid overwriting a seeded v2 salary with 0 when v1 monthly_income was left at its default 0.
        warnings.push('budget_settings.monthly_income เป็น 0 — คงค่า settings.salary เดิมใน v2 ไว้');
      }
    }
  }

  // 2. Map subscriptions -> v2 subscriptions (card, pot ใช้ตามใจ) or AirPods installment (SPayLater)
  const subscriptions = [];
  const installments = [];
  let beforeSubsTotalSatang = 0;

  for (const row of subRows) {
    const name = String(row.name ?? '').trim();
    if (!name) throw new Error('พบ subscription ที่ไม่มีชื่อ');
    const amountSatang = parseMoneyToSatang(row.price);
    beforeSubsTotalSatang += amountSatang;

    const billingDay = parseBillingDay(row.billing_day);
    const v1Key = buildV1Key('subscriptions', row, seenFingerprints);

    if (isAirpodsName(name)) {
      const firstChargeDate = resolveAirpodsFirstDate(options.airpodsFirst, billingDay);
      installments.push({
        id: deterministicUuid(userScope, 'installments', v1Key),
        v1Key,
        name,
        perInstallmentSatang: amountSatang,
        count: airpodsCount,
        firstChargeDate,
        sourceKind: 'paylater',
        potName: 'ใช้ตามใจ',
      });
      continue;
    }

    const frequency = String(row.frequency ?? '').trim();
    if (frequency !== 'monthly' && frequency !== 'yearly') {
      throw new Error(`frequency ของ subscription "${name}" ไม่ถูกต้อง: ${frequency}`);
    }

    let billingMonth = null;
    if (frequency === 'yearly') {
      if (row.created_at && String(row.created_at).trim() !== '') {
        const createdBangkok = toBangkokDate(row.created_at);
        billingMonth = Number(createdBangkok.slice(5, 7));
      } else {
        billingMonth = 1;
        warnings.push(`subscription รายปี "${name}" ไม่มี created_at — ตั้ง billing_month=1 กรุณาตรวจสอบในแอป`);
      }
    }

    subscriptions.push({
      id: deterministicUuid(userScope, 'subscriptions', v1Key),
      v1Key,
      name,
      amountSatang,
      frequency,
      billingDay,
      billingMonth,
      sourceKind: 'credit_card',
      potName: 'ใช้ตามใจ',
      active: true,
    });
  }

  // 3. Map budget_entries -> v2 transactions (out, cash->bank / card->credit_card, pot ใช้ตามใจ)
  const transactions = [];
  let beforeBudgetTotalSatang = 0;

  for (const row of budgetRows) {
    const amountSatang = parseMoneyToSatang(row.amount);
    beforeBudgetTotalSatang += amountSatang;

    const paymentType = String(row.payment_type ?? '').trim();
    let sourceKind;
    if (paymentType === 'cash') sourceKind = 'bank';
    else if (paymentType === 'card') sourceKind = 'credit_card';
    else throw new Error(`payment_type ไม่ถูกต้องใน budget_entries: ${paymentType}`);

    let category = String(row.category ?? '').trim();
    if (!VALID_CATEGORIES.has(category)) {
      warnings.push(`หมวดหมู่ "${category}" ใน budget_entries ไม่อยู่ในรายการ v2 — แปลงเป็น "other"`);
      category = 'other';
    }

    const date = toBangkokDate(row.entry_date);
    const v1Key = buildV1Key('budget_entries', row, seenFingerprints);
    const marker = `[v1:budget:${v1Key}]`;

    transactions.push({
      id: deterministicUuid(userScope, 'transactions', 'budget', v1Key),
      v1Key,
      marker,
      date,
      amountSatang,
      direction: 'out',
      sourceKind,
      potName: 'ใช้ตามใจ',
      category,
      note: formatTransactionNote(row.name, row.note, marker),
    });
  }

  // 4. Map transfer_entries (incoming -> Transaction in on bank; outgoing -> skipped + reported)
  let transferIncomingCount = 0;
  let transferIncomingSatang = 0;
  let transferOutgoingCount = 0;
  let transferOutgoingSatang = 0;

  for (const row of transferRows) {
    const amountSatang = parseMoneyToSatang(row.amount);
    const direction = String(row.direction ?? '').trim();

    if (direction !== 'incoming') {
      transferOutgoingCount++;
      transferOutgoingSatang += amountSatang;
      continue;
    }

    transferIncomingCount++;
    transferIncomingSatang += amountSatang;

    const date = toBangkokDate(row.entry_date);
    const v1Key = buildV1Key('transfer_entries', row, seenFingerprints);
    const marker = `[v1:transfer:${v1Key}]`;

    transactions.push({
      id: deterministicUuid(userScope, 'transactions', 'transfer', v1Key),
      v1Key,
      marker,
      date,
      amountSatang,
      direction: 'in',
      sourceKind: 'bank',
      potName: null,
      category: 'other',
      note: formatTransactionNote(row.name, row.note, marker),
    });
  }

  if (transferOutgoingCount > 0) {
    warnings.push(
      `พบ transfer_entries direction!="incoming" จำนวน ${transferOutgoingCount} รายการ (${formatBaht(transferOutgoingSatang)} บาท) — ข้ามตามกฎการย้ายข้อมูล`,
    );
  }

  const afterSubsTotalSatang = subscriptions.reduce((s, item) => s + item.amountSatang, 0);
  const afterInstPerPeriodSatang = installments.reduce((s, item) => s + item.perInstallmentSatang, 0);
  const txOut = transactions.filter((t) => t.direction === 'out');
  const txIn = transactions.filter((t) => t.direction === 'in');

  const summary = {
    before: {
      budgetSettings: {
        count: settingsRows.length,
        monthlyIncomeSatang: beforeMonthlyIncomeSatang,
      },
      subscriptions: {
        count: subRows.length,
        totalSatang: beforeSubsTotalSatang,
      },
      budgetEntries: {
        count: budgetRows.length,
        totalSatang: beforeBudgetTotalSatang,
      },
      transferEntries: {
        count: transferRows.length,
        incomingCount: transferIncomingCount,
        incomingSatang: transferIncomingSatang,
        outgoingCount: transferOutgoingCount,
        outgoingSatang: transferOutgoingSatang,
      },
    },
    after: {
      settings: {
        willUpdate: mappedSettings !== null,
        salarySatang: mappedSettings ? mappedSettings.salarySatang : null,
      },
      subscriptions: {
        count: subscriptions.length,
        totalSatang: afterSubsTotalSatang,
      },
      installments: {
        count: installments.length,
        perInstallmentTotalSatang: afterInstPerPeriodSatang,
      },
      transactionsOut: {
        count: txOut.length,
        totalSatang: txOut.reduce((s, t) => s + t.amountSatang, 0),
      },
      transactionsIn: {
        count: txIn.length,
        totalSatang: txIn.reduce((s, t) => s + t.amountSatang, 0),
      },
    },
    skipped: {
      outgoingTransfers: {
        count: transferOutgoingCount,
        totalSatang: transferOutgoingSatang,
      },
    },
  };

  return {
    settings: mappedSettings,
    subscriptions,
    installments,
    transactions,
    summary,
    warnings,
  };
}

/**
 * Build a human-readable summary comparing v1 source tables against mapped v2 targets.
 */
export function formatDryRunReport(mapped, { applyMode = false } = {}) {
  const { before, after, skipped } = mapped.summary;
  const lines = [];

  lines.push(
    applyMode
      ? '=== SubTracker v1 -> v2 Migration (APPLY) ==='
      : '=== SubTracker v1 -> v2 Migration (DRY-RUN — ยังไม่เขียนลงฐานข้อมูล) ===',
  );
  lines.push('');
  lines.push('ก่อนย้าย (v1 CSV):');
  lines.push(
    `  - budget_settings : ${before.budgetSettings.count} แถว | monthly_income = ${formatBaht(before.budgetSettings.monthlyIncomeSatang)} บาท`,
  );
  lines.push(
    `  - subscriptions   : ${before.subscriptions.count} แถว | รวมราคา/รอบ = ${formatBaht(before.subscriptions.totalSatang)} บาท`,
  );
  lines.push(
    `  - budget_entries  : ${before.budgetEntries.count} แถว | รวมรายจ่าย = ${formatBaht(before.budgetEntries.totalSatang)} บาท`,
  );
  lines.push(
    `  - transfer_entries: ${before.transferEntries.count} แถว | incoming ${before.transferEntries.incomingCount} (${formatBaht(before.transferEntries.incomingSatang)} บาท), outgoing ${before.transferEntries.outgoingCount} (${formatBaht(before.transferEntries.outgoingSatang)} บาท)`,
  );

  lines.push('');
  lines.push('หลังแปลง (v2 targets):');
  lines.push(
    `  - settings        : ${after.settings.willUpdate ? `salary = ${formatBaht(after.settings.salarySatang)} บาท` : 'ไม่อัปเดต (ไม่มีข้อมูล)'}`,
  );
  lines.push(
    `  - subscriptions   : ${after.subscriptions.count} แถว | รวม = ${formatBaht(after.subscriptions.totalSatang)} บาท (บัตรเครดิต · pot ใช้ตามใจ)`,
  );
  lines.push(
    `  - installments    : ${after.installments.count} แถว | ค่างวดรวม/เดือน = ${formatBaht(after.installments.perInstallmentTotalSatang)} บาท (SPayLater · pot ใช้ตามใจ)`,
  );
  lines.push(
    `  - transactions(out): ${after.transactionsOut.count} แถว | รวม = ${formatBaht(after.transactionsOut.totalSatang)} บาท`,
  );
  lines.push(
    `  - transactions(in) : ${after.transactionsIn.count} แถว | รวม = ${formatBaht(after.transactionsIn.totalSatang)} บาท (บัญชี)`,
  );

  if (skipped.outgoingTransfers.count > 0) {
    lines.push(
      `  - skipped (outgoing): ${skipped.outgoingTransfers.count} แถว | รวม = ${formatBaht(skipped.outgoingTransfers.totalSatang)} บาท`,
    );
  }

  lines.push('');
  lines.push('ตรวจสอบยอดเทียบก่อน/หลัง:');
  const subsAfterCombined = after.subscriptions.totalSatang + after.installments.perInstallmentTotalSatang;
  lines.push(
    `  - subscriptions (v1 ${before.subscriptions.count} แถว / ${formatBaht(before.subscriptions.totalSatang)}) == v2 subs+installments (${after.subscriptions.count + after.installments.count} แถว / ${formatBaht(subsAfterCombined)})`,
  );
  lines.push(
    `  - budget_entries (v1 ${before.budgetEntries.count} แถว / ${formatBaht(before.budgetEntries.totalSatang)}) == v2 transactions(out) (${after.transactionsOut.count} แถว / ${formatBaht(after.transactionsOut.totalSatang)})`,
  );
  lines.push(
    `  - transfer_entries incoming (v1 ${before.transferEntries.incomingCount} แถว / ${formatBaht(before.transferEntries.incomingSatang)}) == v2 transactions(in) (${after.transactionsIn.count} แถว / ${formatBaht(after.transactionsIn.totalSatang)})`,
  );

  if (mapped.warnings.length > 0) {
    lines.push('');
    lines.push('คำเตือน:');
    for (const w of mapped.warnings) {
      lines.push(`  ! ${w}`);
    }
  }

  return lines.join('\n');
}

async function fetchAllRows(client, table, columns) {
  const pageSize = 1000;
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`โหลดข้อมูลเดิมจาก ${table} ไม่สำเร็จ: ${error.message}`);
    const chunk = data ?? [];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return all;
}

async function insertInChunks(client, table, rows, chunkSize = 100) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error } = await client.from(table).insert(slice);
    if (error) {
      throw new Error(`เพิ่มข้อมูลลง ${table} ไม่สำเร็จ: ${error.message}`);
    }
  }
}

/**
 * Apply mapped v2 records idempotently through a user-authenticated Supabase client (anon key + RLS).
 */
export async function applyMigration(mapped, client, userId) {
  if (!userId) {
    throw new Error('ไม่พบ userId สำหรับ RLS');
  }

  // Ensure default payment_sources and pots exist for first-time accounts.
  const { error: seedError } = await client.rpc('seed_defaults');
  if (seedError) {
    throw new Error(`seed_defaults ไม่สำเร็จ: ${seedError.message}`);
  }

  const [sources, pots, existingSettings, existingSubs, existingInsts, existingTxs] = await Promise.all([
    fetchAllRows(client, 'payment_sources', 'id, name, kind'),
    fetchAllRows(client, 'pots', 'id, name'),
    client.from('settings').select('user_id, salary, pay_day').eq('user_id', userId).maybeSingle(),
    fetchAllRows(client, 'subscriptions', 'id, name'),
    fetchAllRows(client, 'installments', 'id, name'),
    fetchAllRows(client, 'transactions', 'id, note'),
  ]);

  if (existingSettings.error) {
    throw new Error(`โหลด settings ไม่สำเร็จ: ${existingSettings.error.message}`);
  }

  const bankSource = sources.find((s) => s.kind === 'bank') ?? sources.find((s) => s.name === 'บัญชี');
  const cardSource =
    sources.find((s) => s.kind === 'credit_card') ?? sources.find((s) => s.name.includes('บัตร'));
  const paylaterSource =
    sources.find((s) => s.kind === 'paylater') ?? sources.find((s) => s.name === 'SPayLater');
  const playPot = pots.find((p) => p.name === 'ใช้ตามใจ');

  if (!bankSource) throw new Error('ไม่พบ payment_source ชนิด bank (บัญชี) ในฐานข้อมูล v2');
  if (!cardSource) throw new Error('ไม่พบ payment_source ชนิด credit_card (บัตรเครดิต) ในฐานข้อมูล v2');
  if (mapped.installments.length > 0 && !paylaterSource) {
    throw new Error('ไม่พบ payment_source ชนิด paylater (SPayLater) ในฐานข้อมูล v2');
  }
  if (!playPot) throw new Error('ไม่พบ pot ชื่อ "ใช้ตามใจ" ในฐานข้อมูล v2');

  const sourceIdByKind = {
    bank: bankSource.id,
    credit_card: cardSource.id,
    paylater: paylaterSource?.id ?? null,
  };

  let settingsAction = 'skipped';
  if (mapped.settings !== null) {
    const targetSalary = satangToNumeric(mapped.settings.salarySatang);
    const currentSalary = existingSettings.data ? satangToNumeric(Math.round(Number(existingSettings.data.salary) * 100)) : null;
    if (currentSalary === targetSalary) {
      settingsAction = 'unchanged';
    } else {
      const payDay = existingSettings.data?.pay_day ?? 10;
      const { error: upsertErr } = await client
        .from('settings')
        .upsert({ user_id: userId, salary: targetSalary, pay_day: payDay }, { onConflict: 'user_id' });
      if (upsertErr) throw new Error(`อัปเดต settings.salary ไม่สำเร็จ: ${upsertErr.message}`);
      settingsAction = 'updated';
    }
  }

  const existingSubIds = new Set(existingSubs.map((r) => r.id));
  const subsToInsert = mapped.subscriptions
    .filter((s) => !existingSubIds.has(s.id))
    .map((s) => ({
      id: s.id,
      user_id: userId,
      name: s.name,
      amount: satangToNumeric(s.amountSatang),
      frequency: s.frequency,
      billing_day: s.billingDay,
      billing_month: s.billingMonth,
      source_id: sourceIdByKind[s.sourceKind],
      pot_id: s.potName === 'ใช้ตามใจ' ? playPot.id : null,
      active: s.active,
    }));

  const existingInstIds = new Set(existingInsts.map((r) => r.id));
  const instsToInsert = mapped.installments
    .filter((inst) => !existingInstIds.has(inst.id))
    .map((inst) => ({
      id: inst.id,
      user_id: userId,
      name: inst.name,
      per_installment: satangToNumeric(inst.perInstallmentSatang),
      count: inst.count,
      first_charge_date: inst.firstChargeDate,
      source_id: sourceIdByKind[inst.sourceKind],
      pot_id: inst.potName === 'ใช้ตามใจ' ? playPot.id : null,
    }));

  const existingTxIds = new Set(existingTxs.map((r) => r.id));
  const existingTxNotes = existingTxs.map((r) => String(r.note ?? ''));
  const txsToInsert = mapped.transactions
    .filter((tx) => {
      if (existingTxIds.has(tx.id)) return false;
      return !existingTxNotes.some((note) => note.includes(tx.marker));
    })
    .map((tx) => ({
      id: tx.id,
      user_id: userId,
      date: tx.date,
      amount: satangToNumeric(tx.amountSatang),
      direction: tx.direction,
      source_id: sourceIdByKind[tx.sourceKind],
      pot_id: tx.potName === 'ใช้ตามใจ' ? playPot.id : null,
      category: tx.category,
      note: tx.note,
    }));

  await insertInChunks(client, 'subscriptions', subsToInsert);
  await insertInChunks(client, 'installments', instsToInsert);
  await insertInChunks(client, 'transactions', txsToInsert);

  return {
    settingsAction,
    inserted: {
      subscriptions: subsToInsert.length,
      installments: instsToInsert.length,
      transactions: txsToInsert.length,
    },
    skipped: {
      subscriptions: mapped.subscriptions.length - subsToInsert.length,
      installments: mapped.installments.length - instsToInsert.length,
      transactions: mapped.transactions.length - txsToInsert.length,
    },
  };
}
