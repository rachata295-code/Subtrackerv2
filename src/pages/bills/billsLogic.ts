import {
  billAmount,
  installmentSchedule,
  payPeriod,
  potStatus,
  statementFor,
  subscriptionCharges,
} from '../../domain';
import { thaiMonthShort } from '../../lib/thaiDate';
import {
  CATEGORY_LABELS,
  type Category,
  type FinanceData,
  type ISODate,
  type Installment,
  type PayPeriod,
  type PaymentSource,
  type PeriodKey,
  type Pot,
  type PotStatus,
  type Satang,
  type StatementWindow,
  type Subscription,
} from '../../types/finance';

export const THAI_MONTHS_FULL = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const;

const CATEGORY_LABEL: Record<Category, string> = {
  ...CATEGORY_LABELS,
  bills: 'บิล',
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Bangkok is permanently UTC+7 with no DST, so shifting UTC ms yields an exact local calendar date. */
export function todayBangkok(now: Date = new Date()): ISODate {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

export function parseIsoDate(iso: ISODate): { year: number; month1: number; month0: number; day: number } {
  const [year, month1, day] = iso.split('-').map(Number);
  return { year, month1, month0: month1 - 1, day };
}

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const { year, month0, day } = parseIsoDate(value);
  const dt = new Date(Date.UTC(year, month0, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month0 && dt.getUTCDate() === day;
}

export function addDaysIso(iso: ISODate, deltaDays: number): ISODate {
  const { year, month0, day } = parseIsoDate(iso);
  const dt = new Date(Date.UTC(year, month0, day + deltaDays));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatThaiDateShort(iso: ISODate): string {
  const { month0, day } = parseIsoDate(iso);
  return `${day} ${thaiMonthShort(month0)}`;
}

export function formatThaiDateFull(iso: ISODate): string {
  const { year, month0, day } = parseIsoDate(iso);
  return `${day} ${thaiMonthShort(month0)} ${year + 543}`;
}

export function formatStatementKeyThai(key: PeriodKey): string {
  const [yearStr, monthStr] = key.split('-');
  const year = Number(yearStr);
  const month0 = Number(monthStr) - 1;
  return `${thaiMonthShort(month0)} ${year + 543}`;
}

export function formatCycleRange(win: StatementWindow): string {
  return `${formatThaiDateShort(win.start)} – ${formatThaiDateShort(win.end)}`;
}

export function resolvePlayPot(pots: Pot[]): Pot | undefined {
  // Prefer the canonical "ใช้ตามใจ" pot by name so custom Supabase UUIDs work without hardcoding IDs.
  return pots.find((p) => p.name === 'ใช้ตามใจ') ?? pots.find((p) => p.rollover) ?? pots[0];
}

export interface SourceBillCycles {
  current: StatementWindow;
  previous: StatementWindow[];
}

/**
 * Picks the active statement to pay now: if we are between a closed statement's end and its dueDate
 * (e.g. Nov 15 for a credit card closed Nov 10 and due Nov 24), that closed statement stays current
 * until its dueDate passes; otherwise the accruing statement for `today` is current.
 */
export function getSourceBillCycles(src: PaymentSource, today: ISODate, historyCount = 3): SourceBillCycles {
  const accruing = statementFor(src, today);
  const prior = statementFor(src, addDaysIso(accruing.start, -1));
  const current = today <= prior.dueDate ? prior : accruing;

  const previous: StatementWindow[] = [];
  let cursor = current;
  for (let i = 0; i < historyCount; i++) {
    cursor = statementFor(src, addDaysIso(cursor.start, -1));
    previous.push(cursor);
  }
  return { current, previous };
}

export interface CycleChargeItem {
  id: string;
  date: ISODate;
  title: string;
  detail: string;
  amount: Satang;
  sourceId: string;
  potId: string | null;
}

export function getCycleCharges(src: PaymentSource, win: StatementWindow, data: FinanceData): CycleChargeItem[] {
  const items: CycleChargeItem[] = [];

  for (const tx of data.transactions) {
    if (tx.sourceId === src.id && tx.direction === 'out' && tx.date >= win.start && tx.date <= win.end) {
      items.push({
        id: `tx-${tx.id}`,
        date: tx.date,
        title: tx.note || CATEGORY_LABEL[tx.category],
        detail: CATEGORY_LABEL[tx.category],
        amount: tx.amount,
        sourceId: src.id,
        potId: tx.potId,
      });
    }
  }

  for (const sub of data.subscriptions) {
    if (sub.sourceId !== src.id || !sub.active) continue;
    const charges = subscriptionCharges(sub, win.start, win.end);
    charges.forEach((charge, idx) => {
      items.push({
        id: `sub-${sub.id}-${charge.date}-${idx}`,
        date: charge.date,
        title: sub.name,
        detail: sub.frequency === 'yearly' ? 'สมาชิกรายปี' : 'สมาชิกรายเดือน',
        amount: charge.amount,
        sourceId: src.id,
        potId: sub.potId,
      });
    });
  }

  for (const inst of data.installments) {
    if (inst.sourceId !== src.id) continue;
    for (const charge of installmentSchedule(inst)) {
      if (charge.chargeDate >= win.start && charge.chargeDate <= win.end) {
        items.push({
          id: `inst-${inst.id}-${charge.n}`,
          date: charge.chargeDate,
          title: `${inst.name} งวด ${charge.n}/${inst.count}`,
          detail: `ผ่อนชำระงวดที่ ${charge.n}`,
          amount: charge.amount,
          sourceId: src.id,
          potId: inst.potId,
        });
      }
    }
  }

  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'th'));
}

export interface InstallmentProgress {
  currentN: number;
  count: number;
  remainingSatang: Satang;
  endDate: ISODate;
}

export function getInstallmentProgress(inst: Installment, today: ISODate): InstallmentProgress {
  const schedule = installmentSchedule(inst);
  let currentN = 0;
  let remainingSatang = 0;

  for (const item of schedule) {
    if (item.chargeDate <= today) {
      currentN = item.n;
    } else {
      remainingSatang += item.amount;
    }
  }

  const endDate = schedule.length > 0 ? schedule[schedule.length - 1].chargeDate : inst.firstChargeDate;
  return {
    currentN,
    count: inst.count,
    remainingSatang,
    endDate,
  };
}

export interface OverBudgetPeriod {
  period: PayPeriod;
  status: PotStatus;
}

/**
 * Simulates adding or updating `candidate` inside `data` and checks every pay period touched by
 * its schedule with `potStatus`. Any period with `over === true` is returned in chronological order.
 */
export function findOverPeriodsForInstallment(
  data: FinanceData,
  playPot: Pot,
  candidate: Installment,
  editingId?: string,
): OverBudgetPeriod[] {
  if (candidate.potId !== playPot.id) return [];

  const source = data.sources.find((s) => s.id === candidate.sourceId);
  if (!source) return [];

  const simulated: FinanceData = {
    ...data,
    installments: editingId
      ? data.installments.map((item) => (item.id === editingId ? candidate : item))
      : [...data.installments, candidate],
  };

  const periodsByKey = new Map<PeriodKey, PayPeriod>();
  for (const charge of installmentSchedule(candidate)) {
    // SPEC §4: bills belong to payPeriod(dueDate - 1 day) because due-by-10th bills draw from the prior salary.
    const period =
      source.dueDay !== null
        ? payPeriod(addDaysIso(statementFor(source, charge.chargeDate).dueDate, -1), data.settings.payDay)
        : payPeriod(charge.chargeDate, data.settings.payDay);
    if (!periodsByKey.has(period.key)) {
      periodsByKey.set(period.key, period);
    }
  }

  const over: OverBudgetPeriod[] = [];
  for (const period of periodsByKey.values()) {
    const status = potStatus(playPot, period.key, simulated);
    if (status.over) {
      over.push({ period, status });
    }
  }
  return over;
}

export function subscriptionMonthlySatang(sub: Subscription): Satang {
  return sub.frequency === 'yearly' ? Math.round(sub.amount / 12) : sub.amount;
}

export function totalMonthlySubscriptionsSatang(subs: Subscription[]): Satang {
  const raw = subs
    .filter((s) => s.active)
    .reduce((sum, s) => sum + (s.frequency === 'yearly' ? s.amount / 12 : s.amount), 0);
  return Math.round(raw);
}

export function satangToBaht(satang: Satang): number {
  return satang / 100;
}

export function bahtToSatang(baht: number): Satang {
  return Math.round(baht * 100);
}

export interface ChannelCycleSummary {
  source: PaymentSource;
  statementKey: PeriodKey | null;
  dueDate: ISODate | null;
  dueBy: boolean;
  amountSatang: Satang;
  paid: boolean;
}

export interface BillsCycleSummary {
  channels: ChannelCycleSummary[];
  totalSatang: Satang;
  paidSatang: Satang;
  unpaidSatang: Satang;
}

/**
 * Computes per-channel and grand totals for the active billing round.
 * Card/paylater channels rely exclusively on `billAmount` (SPEC phase 1 §4) so subscriptions and
 * installments billed to a card are never double-counted; non-billed bank sources appear only if
 * they carry active recurring charges in the current pay period.
 */
export function computeBillsCycleSummary(data: FinanceData, today: ISODate): BillsCycleSummary {
  const activeSources = data.sources.filter((s) => !s.archived);
  const period = payPeriod(today, data.settings.payDay);
  const channels: ChannelCycleSummary[] = [];
  const directChannels: ChannelCycleSummary[] = [];

  for (const src of activeSources) {
    if (src.kind === 'credit_card' || src.kind === 'paylater') {
      const { current } = getSourceBillCycles(src, today, 0);
      const amountSatang = billAmount(src, current.key, data);
      const paid = data.payments.some((p) => p.sourceId === src.id && p.statementKey === current.key);
      channels.push({
        source: src,
        statementKey: current.key,
        dueDate: current.dueDate,
        dueBy: src.kind === 'paylater',
        amountSatang,
        paid,
      });
      continue;
    }

    // Direct bank subscriptions/installments have no statement bill, so sum their charges in the current pay period.
    let bankRecurring = 0;
    for (const sub of data.subscriptions) {
      if (sub.sourceId !== src.id || !sub.active) continue;
      for (const charge of subscriptionCharges(sub, period.start, period.end)) {
        bankRecurring += charge.amount;
      }
    }
    for (const inst of data.installments) {
      if (inst.sourceId !== src.id) continue;
      for (const charge of installmentSchedule(inst)) {
        if (charge.chargeDate >= period.start && charge.chargeDate <= period.end) {
          bankRecurring += charge.amount;
        }
      }
    }

    if (bankRecurring > 0) {
      directChannels.push({
        source: src,
        statementKey: null,
        dueDate: null,
        dueBy: false,
        amountSatang: bankRecurring,
        paid: false,
      });
    }
  }

  const orderedChannels = [...channels, ...directChannels];

  let totalSatang = 0;
  let paidSatang = 0;
  for (const ch of orderedChannels) {
    totalSatang += ch.amountSatang;
    if (ch.paid) paidSatang += ch.amountSatang;
  }

  return {
    channels: orderedChannels,
    totalSatang,
    paidSatang,
    unpaidSatang: totalSatang - paidSatang,
  };
}

export function formatRepoError(prefix: string, err: unknown, fallback = `${prefix} กรุณาลองใหม่`): string {
  if (err instanceof Error && err.message.trim()) {
    return `${prefix}: ${err.message.trim()}`;
  }
  return fallback;
}
