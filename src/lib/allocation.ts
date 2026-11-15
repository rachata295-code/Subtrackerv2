import type { Hue } from '../components/ui/hue';

export type Segment = {
  id: string;
  label: string;
  amount: number;
  hue: Hue | 'remaining';
  state?: 'reserved' | 'paid';
};

export interface Allocation {
  segments: (Segment & { fraction: number })[];
  /** total minus the sum of parts; negative when over budget. */
  remaining: number;
  over: boolean;
  /** Share of the bar left unallocated; 0 when over budget (the bar is then full of segments). */
  remainingFraction: number;
}

// Whole satang: sums are done on integers so 0.1 + 0.2 === 0.3 and "exactly spent" is never flagged over by float noise.
function toSatang(amount: number): number {
  return Math.round(Number((amount * 100).toPrecision(15)));
}

export function computeAllocation(total: number, parts: Segment[]): Allocation {
  // Fail loudly: a NaN or negative amount would draw a broken bar on a money screen.
  if (!Number.isFinite(total) || total < 0) throw new RangeError(`Total must be a finite number >= 0, got ${total}`);
  for (const p of parts) {
    if (!Number.isFinite(p.amount) || p.amount < 0) {
      throw new RangeError(`Amount for "${p.id}" must be a finite number >= 0, got ${p.amount}`);
    }
  }

  const kept = parts.filter((p) => p.amount > 0);
  const totalS = toSatang(total);
  const sumS = kept.reduce((s, p) => s + toSatang(p.amount), 0);
  const remainingS = totalS - sumS;

  // Denominator is the larger of the two so over budget scales the segments to fill (not overflow) the bar.
  const denom = Math.max(totalS, sumS);
  const fractionOf = (satang: number) => (denom > 0 ? satang / denom : 0);

  return {
    segments: kept.map((p) => ({ ...p, fraction: fractionOf(toSatang(p.amount)) })),
    remaining: remainingS / 100,
    over: remainingS < 0,
    remainingFraction: remainingS > 0 ? fractionOf(remainingS) : 0,
  };
}
