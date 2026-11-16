import { addDays, addMonths, clampDay, formatISODate, parseISODate } from '../../domain/date';
import { formatTHB } from '../../lib/money';
import { thaiMonthShort } from '../../lib/thaiDate';
import type {
  BalanceCheck,
  FinanceData,
  ISODate,
  PaymentSource,
  Satang,
} from '../../types/finance';

const MS_PER_DAY = 86_400_000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Converts a baht float from CurrencyField to integer satang without float drift. */
export function bahtToSatang(baht: number): Satang {
  return Math.round(Number((baht * 100).toPrecision(15)));
}

/** Returns today's calendar date in Asia/Bangkok as YYYY-MM-DD regardless of host timezone. */
export function bangkokToday(now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function isValidISODate(value: string): value is ISODate {
  if (!ISO_DATE_RE.test(value)) return false;
  const { year, month, day } = parseISODate(value);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

/** Signed whole days from `from` to `to` (positive when `to` is after `from`). */
export function diffDays(from: ISODate, to: ISODate): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  return (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / MS_PER_DAY;
}

export function formatThaiShortDate(iso: ISODate): string {
  const { month, day } = parseISODate(iso);
  return `${day} ${thaiMonthShort(month - 1)}`;
}

export function formatThaiFullDate(iso: ISODate): string {
  const { year, month, day } = parseISODate(iso);
  return `${day} ${thaiMonthShort(month - 1)} ${year + 543}`;
}

/** True when a domain stub throws `not implemented: ...` before Prompt 01 is merged. */
export function isNotImplementedError(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('not implemented:');
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

/**
 * Picks the default bank source per SPEC §5 C2: the active bank receiving the highest
 * total active recurring income, falling back to the first active bank source.
 */
export function pickDefaultBankSource(data: FinanceData): PaymentSource | null {
  const banks = data.sources.filter((s) => s.kind === 'bank' && !s.archived);
  if (banks.length === 0) return null;

  const incomeByBank = new Map<string, Satang>();
  for (const inc of data.recurringIncomes) {
    if (!inc.active) continue;
    incomeByBank.set(inc.sourceId, (incomeByBank.get(inc.sourceId) ?? 0) + inc.amount);
  }

  let best = banks[0];
  let bestAmount = incomeByBank.get(best.id) ?? 0;
  for (const bank of banks.slice(1)) {
    const total = incomeByBank.get(bank.id) ?? 0;
    if (total > bestAmount) {
      best = bank;
      bestAmount = total;
    }
  }
  return best;
}

export function sortBalanceChecksDesc(checks: BalanceCheck[]): BalanceCheck[] {
  return [...checks].sort(
    (a, b) => b.checkedOn.localeCompare(a.checkedOn) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function latestBalanceCheckForSource(checks: BalanceCheck[], sourceId: string): BalanceCheck | null {
  const filtered = checks.filter((c) => c.sourceId === sourceId);
  if (filtered.length === 0) return null;
  return sortBalanceChecksDesc(filtered)[0];
}

export function daysSinceBalanceCheckLabel(checkedOn: ISODate | null, today: ISODate): string {
  if (!checkedOn) return 'ยังไม่เคยเช็กยอด';
  const days = diffDays(checkedOn, today);
  if (days <= 0) return 'เช็กยอดวันนี้';
  return `เช็กยอด ${days} วันก่อน`;
}

export function balanceCheckDiffText(check: BalanceCheck): string {
  if (check.expectedBefore === null) return 'ตั้งยอดเริ่มต้น';
  const diff = check.actual - check.expectedBefore;
  if (Math.abs(diff) < 100) return 'ตรงกัน';
  const signedBaht = formatTHB(diff / 100);
  const formatted = diff > 0 ? `+${signedBaht}` : signedBaht;
  return check.adjustmentTxId ? `ต่าง ${formatted} (ลืมจด)` : `ต่าง ${formatted}`;
}

/**
 * Checks if a PlanItem name duplicates an active credit card/paylater bill, subscription,
 * or installment so the form can warn against double-counting (SPEC §5 C5).
 */
export function findDuplicateBillMatch(name: string, data: FinanceData): string | null {
  const normalized = name.trim().toLowerCase();
  if (normalized.length < 2) return null;

  const candidates: string[] = [];
  for (const src of data.sources) {
    if (!src.archived && src.kind !== 'bank') candidates.push(src.name);
  }
  for (const sub of data.subscriptions) {
    if (sub.active) candidates.push(sub.name);
  }
  for (const inst of data.installments) {
    candidates.push(inst.name);
  }

  for (const candidate of candidates) {
    const candNorm = candidate.trim().toLowerCase();
    if (!candNorm) continue;
    if (normalized.includes(candNorm) || candNorm.includes(normalized)) {
      return candidate;
    }
  }
  return null;
}

/** Shifts a previous-period dueOn forward by one calendar month, clamped to the target pay period. */
export function shiftDueDateToPeriod(
  dueOn: ISODate | null,
  targetStart: ISODate,
  targetEnd: ISODate,
): ISODate | null {
  if (!dueOn) return null;
  const parsed = parseISODate(dueOn);
  const nextMonth = addMonths(parsed.year, parsed.month, 1);
  const shifted = formatISODate(nextMonth.year, nextMonth.month, clampDay(nextMonth.year, nextMonth.month, parsed.day));
  if (shifted < targetStart) return targetStart;
  if (shifted > targetEnd) return targetEnd;
  return shifted;
}

export { addDays };
