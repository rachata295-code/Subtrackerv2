import { payPeriod as domainPayPeriod } from '../../domain';
import { thaiMonthShort } from '../../lib/thaiDate';
import type { MoneyKind } from '../../components/ui/Money';
import type { Category, ISODate, PayPeriod, Transaction } from '../../types/finance';

export const CATEGORY_OPTIONS: readonly { value: Category; label: string }[] = [
  { value: 'food', label: 'อาหาร' },
  { value: 'transport', label: 'เดินทาง' },
  { value: 'shopping', label: 'ช้อปปิ้ง' },
  { value: 'entertainment', label: 'บันเทิง' },
  { value: 'health', label: 'สุขภาพ' },
  { value: 'bills', label: 'บิล/ค่าบริการ' },
  { value: 'other', label: 'อื่นๆ' },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  food: 'อาหาร',
  transport: 'เดินทาง',
  shopping: 'ช้อปปิ้ง',
  entertainment: 'บันเทิง',
  health: 'สุขภาพ',
  bills: 'บิล/ค่าบริการ',
  other: 'อื่นๆ',
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns today's calendar date in Asia/Bangkok so display does not drift with host TZ. */
export function todayBangkok(now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isValidISODate(value: string): value is ISODate {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseISO(iso: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  return { year, month, day };
}

function formatISO(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDaysISO(iso: ISODate, deltaDays: number): ISODate {
  const { year, month, day } = parseISO(iso);
  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return formatISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function effectivePayDay(year: number, month: number, payDay: number): number {
  const clamped = Math.max(1, Math.min(31, Math.trunc(payDay)));
  return Math.min(clamped, daysInMonth(year, month));
}

function computePayPeriod(date: ISODate, payDay: number): PayPeriod {
  const { year, month, day } = parseISO(date);
  const currentStartDay = effectivePayDay(year, month, payDay);
  const inCurrentMonth = day >= currentStartDay;
  const startYear = inCurrentMonth ? year : month === 1 ? year - 1 : year;
  const startMonth = inCurrentMonth ? month : month === 1 ? 12 : month - 1;
  const startDay = effectivePayDay(startYear, startMonth, payDay);

  const nextYear = startMonth === 12 ? startYear + 1 : startYear;
  const nextMonth = startMonth === 12 ? 1 : startMonth + 1;
  const nextPayDate = formatISO(nextYear, nextMonth, effectivePayDay(nextYear, nextMonth, payDay));

  return {
    key: `${startYear}-${String(startMonth).padStart(2, '0')}`,
    start: formatISO(startYear, startMonth, startDay),
    end: addDaysISO(nextPayDate, -1),
  };
}

/**
 * Delegates to domain.payPeriod once implemented (prompt 02/08), falling back to the
 * SPEC §4 calculation while domain stubs throw "not implemented".
 */
export function resolvePayPeriod(date: ISODate, payDay: number): PayPeriod {
  try {
    return domainPayPeriod(date, payDay);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('not implemented:')) {
      return computePayPeriod(date, payDay);
    }
    throw err;
  }
}

export type PeriodOffset = '0' | '1' | '2';

export interface PeriodOption {
  offset: PeriodOffset;
  label: string;
  period: PayPeriod;
}

export function getPeriodOptions(today: ISODate, payDay: number): PeriodOption[] {
  const p0 = resolvePayPeriod(today, payDay);
  const p1 = resolvePayPeriod(addDaysISO(p0.start, -1), payDay);
  const p2 = resolvePayPeriod(addDaysISO(p1.start, -1), payDay);
  return [
    { offset: '0', label: 'รอบนี้', period: p0 },
    { offset: '1', label: 'รอบก่อน', period: p1 },
    { offset: '2', label: '2 รอบก่อน', period: p2 },
  ];
}

export function formatThaiDate(iso: ISODate): string {
  const { year, month, day } = parseISO(iso);
  return `${day} ${thaiMonthShort(month - 1)} ${year + 543}`;
}

export function formatThaiShort(iso: ISODate): string {
  const { month, day } = parseISO(iso);
  return `${day} ${thaiMonthShort(month - 1)}`;
}

export interface DayGroup {
  date: ISODate;
  transactions: Transaction[];
  displayBaht: number;
  displayKind: MoneyKind;
}

export function groupTransactionsByDay(
  transactions: Transaction[],
  period: PayPeriod,
  sourceFilter: string,
): DayGroup[] {
  const filtered = transactions.filter((tx) => {
    if (tx.date < period.start || tx.date > period.end) return false;
    if (sourceFilter !== 'all' && tx.sourceId !== sourceFilter) return false;
    return true;
  });

  // Sort newest date first while showing later entries within the same day at the top.
  const ordered = [...filtered].reverse().sort((a, b) => b.date.localeCompare(a.date));

  const byDate = new Map<ISODate, Transaction[]>();
  for (const tx of ordered) {
    const list = byDate.get(tx.date);
    if (list) list.push(tx);
    else byDate.set(tx.date, [tx]);
  }

  return Array.from(byDate.entries()).map(([date, list]) => {
    let totalIn = 0;
    let totalOut = 0;
    for (const tx of list) {
      if (tx.direction === 'in') totalIn += tx.amount;
      else totalOut += tx.amount;
    }
    const net = totalIn - totalOut;
    // Net positive days show green +; pure spend days show positive spend total in ink (no minus);
    // mixed days with net outflow show signed spend in ink (never negative/red per SPEC §5.1).
    let displayKind: MoneyKind = 'spend';
    let displayBaht: number;
    if (net > 0) {
      displayKind = 'income';
      displayBaht = net / 100;
    } else if (totalIn === 0) {
      displayBaht = totalOut / 100;
    } else {
      displayBaht = net / 100;
    }
    return { date, transactions: list, displayBaht, displayKind };
  });
}
