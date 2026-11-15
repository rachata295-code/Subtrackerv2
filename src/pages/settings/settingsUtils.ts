import type { Hue } from '../../components/ui/hue';
import type { SelectOption } from '../../components/ui/SelectField';
import { addMonths, formatPeriodKey, parseISODate, parsePeriodKey } from '../../domain/date';
import { payPeriod, payPeriodForKey } from '../../domain/period';
import { thaiMonthShort } from '../../lib/thaiDate';
import type { FinanceData, ISODate, PaymentSource, PeriodKey, SourceKind } from '../../types/finance';

export const HUES_ORDER: readonly Hue[] = ['sky', 'apricot', 'teal', 'stone', 'lilac', 'rose'];

export const HUE_LABEL: Record<Hue, string> = {
  sky: 'ฟ้า',
  apricot: 'ส้ม',
  teal: 'เขียวอมฟ้า',
  stone: 'เทา',
  lilac: 'ม่วงอ่อน',
  rose: 'ชมพู',
};

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  bank: 'บัญชีธนาคาร',
  credit_card: 'บัตรเครดิต',
  paylater: 'PayLater',
};

/** Parses a calendar day strictly as an integer in 1..31, returning null for invalid input. */
export function parseDayOfMonth(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 31) return null;
  return n;
}

/** Picks the first unused hue from the 6-shade palette, falling back to the first shade when all are taken. */
export function pickAvailableHue(usedHues: Hue[]): Hue {
  const used = new Set(usedHues);
  return HUES_ORDER.find((h) => !used.has(h)) ?? HUES_ORDER[0];
}

/** Orders unused hues first so the user picks fresh shades before repeating an existing one. */
export function orderedHuesForPicker(usedHues: Hue[]): { hue: Hue; label: string; used: boolean }[] {
  const used = new Set(usedHues);
  const unusedList = HUES_ORDER.filter((h) => !used.has(h));
  const usedList = HUES_ORDER.filter((h) => used.has(h));
  return [...unusedList, ...usedList].map((hue) => ({
    hue,
    label: HUE_LABEL[hue],
    used: used.has(hue),
  }));
}

/** True if any transaction, subscription, installment, payment, or billing source references this source. */
export function hasLinkedRecords(sourceId: string, data: FinanceData): boolean {
  return (
    data.transactions.some((t) => t.sourceId === sourceId) ||
    data.subscriptions.some((s) => s.sourceId === sourceId) ||
    data.installments.some((i) => i.sourceId === sourceId) ||
    data.payments.some((p) => p.sourceId === sourceId) ||
    data.sources.some((s) => s.id !== sourceId && s.payFromSourceId === sourceId)
  );
}

/** True if any transaction, subscription, or installment references this pot. */
export function hasLinkedPotRecords(potId: string, data: FinanceData): boolean {
  return (
    data.transactions.some((t) => t.potId === potId) ||
    data.subscriptions.some((s) => s.potId === potId) ||
    data.installments.some((i) => i.potId === potId)
  );
}

export function formatSourceSummary(source: PaymentSource, allSources: PaymentSource[]): string {
  const kindText = SOURCE_KIND_LABEL[source.kind];
  if (source.kind === 'bank') return kindText;

  const parts = [kindText];
  if (source.statementCloseDay !== null) {
    parts.push(`ปิดรอบวันที่ ${source.statementCloseDay}`);
  } else {
    parts.push('รอบเดือนปฏิทิน');
  }
  if (source.dueDay !== null) {
    const offsetText = source.dueMonthOffset === 1 ? ' เดือนถัดไป' : '';
    parts.push(`ครบกำหนดวันที่ ${source.dueDay}${offsetText}`);
  }
  if (source.payFromSourceId) {
    const payFrom = allSources.find((s) => s.id === source.payFromSourceId);
    if (payFrom) parts.push(`จ่ายจาก${payFrom.name}`);
  }
  return parts.join(' · ');
}

/** Select value meaning "no start period" (stored as null); an empty string keeps <select> controlled values simple. */
export const BUDGET_START_NONE = '';

/** How many pay periods the picker offers: the current one plus the 11 before it. */
const BUDGET_START_PERIOD_COUNT = 12;

/**
 * Label like "10 พ.ย. – 9 ธ.ค. 2569". Matches the app's other Thai dates (day + short month, and the
 * Buddhist-era year, as in entries/bills); the year is the period's end so a Dec→Jan period reads naturally.
 */
export function formatPayPeriodLabel(key: PeriodKey, payDay: number): string {
  const { start, end } = payPeriodForKey(key, payDay);
  const s = parseISODate(start);
  const e = parseISODate(end);
  return `${s.day} ${thaiMonthShort(s.month - 1)} – ${e.day} ${thaiMonthShort(e.month - 1)} ${e.year + 543}`;
}

/**
 * Options for "เริ่มนับก้อนเงินตั้งแต่รอบ": "ไม่กำหนด", the current pay period (newest first) and the 11 before it.
 * A stored value outside that window is appended so the select never silently shows a different period.
 */
export function budgetStartOptions(today: ISODate, payDay: number, current: PeriodKey | null): SelectOption[] {
  const currentKey = payPeriod(today, payDay).key;
  const { year, month } = parsePeriodKey(currentKey);

  const keys: PeriodKey[] = [];
  for (let i = 0; i < BUDGET_START_PERIOD_COUNT; i++) {
    const ym = addMonths(year, month, -i);
    keys.push(formatPeriodKey(ym.year, ym.month));
  }
  if (current !== null && !keys.includes(current)) keys.push(current);

  return [
    { value: BUDGET_START_NONE, label: 'ไม่กำหนด' },
    ...keys.map((key) => ({
      value: key,
      label: key === currentKey ? `${formatPayPeriodLabel(key, payDay)} (รอบนี้)` : formatPayPeriodLabel(key, payDay),
    })),
  ];
}
