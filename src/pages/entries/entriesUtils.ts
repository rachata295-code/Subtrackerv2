import { payPeriod } from '../../domain';
import { addDays, parseISODate } from '../../domain/date';
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

export type PeriodOffset = '0' | '1' | '2';

export interface PeriodOption {
  offset: PeriodOffset;
  label: string;
  period: PayPeriod;
}

export function getPeriodOptions(today: ISODate, payDay: number): PeriodOption[] {
  const p0 = payPeriod(today, payDay);
  const p1 = payPeriod(addDays(p0.start, -1), payDay);
  const p2 = payPeriod(addDays(p1.start, -1), payDay);
  return [
    { offset: '0', label: 'รอบนี้', period: p0 },
    { offset: '1', label: 'รอบก่อน', period: p1 },
    { offset: '2', label: '2 รอบก่อน', period: p2 },
  ];
}

export function formatThaiDate(iso: ISODate): string {
  const { year, month, day } = parseISODate(iso);
  return `${day} ${thaiMonthShort(month - 1)} ${year + 543}`;
}

export function formatThaiShort(iso: ISODate): string {
  const { month, day } = parseISODate(iso);
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
