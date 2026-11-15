import { thaiMonthShort } from '../../lib/thaiDate';
import type { ISODate, PeriodKey } from '../../types/finance';

export interface ParsedDate {
  year: number;
  /** Zero-based month (0–11) to match thaiMonthShort and Date#getMonth. */
  month0: number;
  day: number;
}

const MS_PER_DAY = 86_400_000;

/** Returns today's calendar date in Asia/Bangkok as YYYY-MM-DD regardless of device timezone. */
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

export function parseISODate(iso: ISODate): ParsedDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new RangeError(`Invalid ISODate: "${iso}"`);
  return {
    year: Number(match[1]),
    month0: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

export function toUTCDateNumber(iso: ISODate): number {
  const { year, month0, day } = parseISODate(iso);
  return Date.UTC(year, month0, day) / MS_PER_DAY;
}

export function addDays(iso: ISODate, deltaDays: number): ISODate {
  const { year, month0, day } = parseISODate(iso);
  const d = new Date(Date.UTC(year, month0, day + deltaDays));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/** Whole calendar days from `from` to `to` (positive when `to` is after `from`). */
export function diffDays(from: ISODate, to: ISODate): number {
  return toUTCDateNumber(to) - toUTCDateNumber(from);
}

export function formatThaiShortDate(iso: ISODate, dueBy = false): string {
  const { day, month0 } = parseISODate(iso);
  return `${dueBy ? '≤' : ''}${day} ${thaiMonthShort(month0)}`;
}

export function formatPeriodMonthShort(key: PeriodKey): string {
  const match = /^\d{4}-(\d{2})$/.exec(key);
  if (!match) throw new RangeError(`Invalid PeriodKey: "${key}"`);
  const month0 = Number(match[1]) - 1;
  return thaiMonthShort(month0);
}
