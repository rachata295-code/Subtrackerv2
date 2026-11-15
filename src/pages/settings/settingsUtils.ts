import type { Hue } from '../../components/ui/hue';
import type { FinanceData, PaymentSource, SourceKind } from '../../types/finance';

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
