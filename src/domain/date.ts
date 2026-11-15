import type { ISODate, PeriodKey } from '../types/finance';

export interface YearMonthDay {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const PERIOD_KEY_RE = /^(\d{4})-(\d{2})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

/** Parse 'YYYY-MM-DD' without touching local timezone or Date string parsing quirks. */
export function parseISODate(iso: ISODate): YearMonthDay {
  const m = ISO_DATE_RE.exec(iso);
  if (!m) throw new RangeError(`Invalid ISODate: ${iso}`);
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

export function formatISODate(year: number, month: number, day: number): ISODate {
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

export function parsePeriodKey(key: PeriodKey): YearMonth {
  const m = PERIOD_KEY_RE.exec(key);
  if (!m) throw new RangeError(`Invalid PeriodKey: ${key}`);
  return {
    year: Number(m[1]),
    month: Number(m[2]),
  };
}

export function formatPeriodKey(year: number, month: number): PeriodKey {
  return `${pad4(year)}-${pad2(month)}`;
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of month index `month` (0-based next month) in UTC is the last day of `month`.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), daysInMonth(year, month));
}

/** Add signed calendar months to (year, month). */
export function addMonths(year: number, month: number, deltaMonths: number): YearMonth {
  const total = year * 12 + (month - 1) + deltaMonths;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (((total % 12) + 12) % 12) + 1;
  return { year: nextYear, month: nextMonth };
}

/** Add signed calendar days in UTC so DST/local timezone never shifts the date. */
export function addDays(iso: ISODate, deltaDays: number): ISODate {
  const { year, month, day } = parseISODate(iso);
  const dt = new Date(Date.UTC(year, month - 1, day + deltaDays));
  return formatISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function nextPeriodKey(key: PeriodKey): PeriodKey {
  const { year, month } = parsePeriodKey(key);
  const next = addMonths(year, month, 1);
  return formatPeriodKey(next.year, next.month);
}
