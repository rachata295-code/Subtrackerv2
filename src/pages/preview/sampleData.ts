import type { Hue } from '../../components/ui/hue';

// All amounts below are leaf rows. Totals (pot, bill sums, spent, play-left) are never typed: they are summed
// from the rows by `derive`, so the screen cannot disagree with its own data.

export interface DayMonth {
  /** Day of month. */
  day: number;
  /** Zero-based, like Date#getMonth. */
  month: number;
}

export type BillId = 'card' | 'spay';

export interface BillItem {
  id: string;
  label: string;
  amount: number;
}

export interface Bill {
  id: BillId;
  /** Short channel name used in tiles. */
  label: string;
  hue: Hue;
  due: DayMonth;
  /** True for "pay by" deadlines (shown as "≤10"). */
  dueBy?: boolean;
  items: BillItem[];
}

export interface UpcomingRow {
  id: string;
  date: DayMonth;
  dueBy?: boolean;
  title: string;
  /** A bill row sums its bill's items and gets a "paid" action (without a note it shows the bill's channel pill); a charge row points at one item. */
  source: { kind: 'bill'; billId: BillId; note?: string } | { kind: 'charge'; itemId: string; channel: { hue: Hue; label: string } };
}

export interface SamplePeriod {
  year: number;
  start: DayMonth;
  end: DayMonth;
  today: DayMonth;
  pot: number;
  carry: number;
  bills: Bill[];
  play: BillItem[];
  upcoming: UpcomingRow[];
}

export const samplePeriod: SamplePeriod = {
  year: 2026,
  start: { day: 10, month: 10 },
  end: { day: 10, month: 11 },
  today: { day: 15, month: 10 },
  pot: 3000,
  carry: 541,
  bills: [
    {
      id: 'card',
      label: 'บิลบัตร',
      hue: 'sky',
      due: { day: 24, month: 10 },
      items: [
        { id: 'claude', label: 'Claude', amount: 699 },
        { id: 'gemini', label: 'Gemini + YouTube', amount: 279 },
        { id: 'icloud', label: 'iCloud', amount: 99 },
      ],
    },
    {
      id: 'spay',
      label: 'SPayLater',
      hue: 'apricot',
      due: { day: 10, month: 11 },
      dueBy: true,
      items: [{ id: 'airpods', label: 'AirPods งวด 3/10', amount: 1381.93 }],
    },
  ],
  play: [
    { id: 'movie', label: 'หนัง', amount: 220 },
    { id: 'tea', label: 'ชานม', amount: 85 },
    { id: 'game', label: 'เกม', amount: 115 },
  ],
  // Listed in date order (the screen renders it as given; the test pins the order).
  upcoming: [
    { id: 'pay-card', date: { day: 24, month: 10 }, title: 'จ่ายบิลบัตร', source: { kind: 'bill', billId: 'card', note: 'จากบัญชี' } },
    {
      id: 'gemini',
      date: { day: 25, month: 10 },
      title: 'Gemini + YouTube',
      source: { kind: 'charge', itemId: 'gemini', channel: { hue: 'sky', label: 'บัตร' } },
    },
    {
      id: 'claude',
      date: { day: 1, month: 11 },
      title: 'Claude',
      source: { kind: 'charge', itemId: 'claude', channel: { hue: 'sky', label: 'บัตร' } },
    },
    {
      id: 'pay-spay',
      date: { day: 10, month: 11 },
      dueBy: true,
      title: 'AirPods งวด 3/10',
      source: { kind: 'bill', billId: 'spay' },
    },
  ],
};

/** Whole satang, rounded the same way as lib/money so sums agree with what is displayed. */
const toSatang = (n: number) => Math.round(Number((n * 100).toPrecision(15)));

/** Sums in integer satang so 0.1 + 0.2 style float noise can never leak into a displayed total. */
export function sumAmounts(values: number[]): number {
  return values.reduce((s, v) => s + toSatang(v), 0) / 100;
}

export function billAmount(bill: Bill): number {
  return sumAmounts(bill.items.map((i) => i.amount));
}

function findItem(period: SamplePeriod, itemId: string): BillItem {
  for (const b of period.bills) {
    const hit = b.items.find((i) => i.id === itemId);
    if (hit) return hit;
  }
  // Fail loudly: a typo in sample data would otherwise render a silent ฿0.
  throw new Error(`Unknown bill item "${itemId}"`);
}

/** Amount shown for an upcoming row, resolved from the bill/item rows rather than stored twice. */
export function upcomingAmount(period: SamplePeriod, row: UpcomingRow): number {
  if (row.source.kind === 'charge') return findItem(period, row.source.itemId).amount;
  const { billId } = row.source;
  const bill = period.bills.find((b) => b.id === billId);
  if (!bill) throw new Error(`Unknown bill "${billId}"`);
  return billAmount(bill);
}

// Midnight UTC so the difference is a whole number of days regardless of DST or the device time zone.
const dayNumber = (year: number, d: DayMonth) => Date.UTC(year, d.month, d.day) / 86_400_000;

export function daysLeft(period: SamplePeriod): number {
  return Math.max(0, dayNumber(period.year, period.end) - dayNumber(period.year, period.today));
}

export interface Derived {
  pot: number;
  billsTotal: number;
  spent: number;
  playLeft: number;
  /** Bills not yet paid. Paying moves money from the account, not from the play budget, so playLeft is unaffected. */
  owed: number;
  daysLeft: number;
  perDay: number;
}

/** `extraSpent` is spending added through the sheet, counted into the play budget. */
export function derive(period: SamplePeriod, paid: ReadonlySet<BillId>, extraSpent = 0): Derived {
  const pot = sumAmounts([period.pot, period.carry]);
  const billsTotal = sumAmounts(period.bills.map(billAmount));
  const spent = sumAmounts([...period.play.map((p) => p.amount), extraSpent]);
  // Subtract in satang so the identity bills + spent + playLeft === pot holds exactly.
  const playLeft = (toSatang(pot) - toSatang(billsTotal) - toSatang(spent)) / 100;
  const owed = sumAmounts(period.bills.filter((b) => !paid.has(b.id)).map(billAmount));
  const left = daysLeft(period);
  // A negative or zero-day remainder has no meaningful daily average.
  const perDay = left > 0 ? Math.max(0, playLeft) / left : 0;
  return { pot, billsTotal, spent, playLeft, owed, daysLeft: left, perDay };
}

export interface PaidState {
  paid: ReadonlySet<BillId>;
  /** The bill paid most recently; the screen uses it to tell whether this payment closed the last open bill. */
  last: BillId | null;
}

export const initialPaidState: PaidState = { paid: new Set(), last: null };

/** Idempotent: paying an already-paid bill returns the same state object, so a double tap changes nothing. */
export function markPaid(state: PaidState, id: BillId): PaidState {
  if (state.paid.has(id)) return state;
  return { paid: new Set(state.paid).add(id), last: id };
}
