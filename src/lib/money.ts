// Thai baht formatting. Hand-rolled around Intl (not style:'currency') because currency style
// prints "THB" or "฿" depending on the engine, and the design needs "฿" and U+2212 everywhere.

const MINUS = '−'; // real minus sign: same width as +, unlike a hyphen
const BAHT = '฿';

// numberingSystem is pinned so a device set to Thai digits cannot change what we render.
const bahtGroup = new Intl.NumberFormat('th-TH', {
  numberingSystem: 'latn',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export interface MoneyParts {
  sign: '' | '−' | '+';
  /** Includes the ฿ symbol and thousands separators, e.g. "฿1,234". */
  baht: string;
  /** Always two digits with the leading dot, e.g. ".07". */
  satang: string;
}

export interface SplitOptions {
  /** Show "+" for positive non-zero amounts (income). Off by default: spend has no sign. */
  showPlus?: boolean;
}

/** Whole satang, rounded half-up, immune to binary float error (1.005 -> 101, not 100). */
function toSatang(abs: number): number {
  // toPrecision(15) snaps 100.49999999999999 back to 100.5 before rounding. An epsilon would
  // not scale: it is too small for large amounts and distorts small ones.
  const satang = Math.round(Number((abs * 100).toPrecision(15)));
  if (!Number.isSafeInteger(satang)) throw new RangeError(`Amount out of range: ${abs}`);
  return satang;
}

export function splitTHB(amount: number, opts: SplitOptions = {}): MoneyParts {
  // Fail loudly: silently rendering ฿0.00 for NaN would hide a real data bug on a money screen.
  if (!Number.isFinite(amount)) throw new RangeError(`Amount must be finite, got ${amount}`);

  const satangTotal = toSatang(Math.abs(amount));
  const baht = Math.floor(satangTotal / 100);
  const cents = satangTotal % 100;

  // Sign comes from the rounded value so -0.001 shows as ฿0.00, never "−฿0.00".
  let sign: MoneyParts['sign'] = '';
  if (satangTotal !== 0) {
    if (amount < 0) sign = MINUS;
    else if (opts.showPlus) sign = '+';
  }

  return {
    sign,
    baht: `${BAHT}${bahtGroup.format(baht)}`,
    satang: `.${String(cents).padStart(2, '0')}`,
  };
}

export function formatTHB(amount: number): string {
  const { sign, baht, satang } = splitTHB(amount);
  return `${sign}${baht}${satang}`;
}
