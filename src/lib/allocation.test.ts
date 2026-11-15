import { describe, expect, it } from 'vitest';
import { computeAllocation, type Segment } from './allocation';

const seg = (id: string, amount: number, hue: Segment['hue'] = 'sky'): Segment => ({ id, label: id, amount, hue });

// Segments plus the unallocated remainder always fill the bar exactly once.
function filled(r: ReturnType<typeof computeAllocation>): number {
  return r.segments.reduce((s, x) => s + x.fraction, 0) + r.remainingFraction;
}

describe('computeAllocation', () => {
  it('computes remaining and fills the bar exactly (under budget)', () => {
    const r = computeAllocation(3541, [seg('a', 1077), seg('b', 1381.93, 'apricot'), seg('c', 420, 'teal')]);
    expect(r.remaining).toBeCloseTo(662.07, 2);
    expect(r.over).toBe(false);
    expect(filled(r)).toBeCloseTo(1, 9);
    expect(r.segments[0].fraction).toBeCloseTo(1077 / 3541, 9);
  });

  it('drops zero-amount parts', () => {
    const r = computeAllocation(1000, [seg('a', 0), seg('b', 400)]);
    expect(r.segments.map((s) => s.id)).toEqual(['b']);
  });

  it('keeps the original order and extra fields of the parts', () => {
    const r = computeAllocation(1000, [{ ...seg('a', 100), state: 'paid' }, seg('b', 200)]);
    expect(r.segments.map((s) => s.id)).toEqual(['a', 'b']);
    expect(r.segments[0].state).toBe('paid');
  });

  // Review Focus 5: over budget must still draw a bar that never exceeds its track.
  it('over budget: over=true, negative remaining, fractions sum to 1 and none exceed 1', () => {
    const r = computeAllocation(3541, [seg('a', 2000), seg('b', 1500, 'apricot'), seg('c', 500, 'teal')]);
    expect(r.over).toBe(true);
    expect(r.remaining).toBeCloseTo(-459, 2);
    expect(r.remainingFraction).toBe(0);
    expect(r.segments.reduce((s, x) => s + x.fraction, 0)).toBeCloseTo(1, 9);
    for (const s of r.segments) expect(s.fraction).toBeLessThanOrEqual(1);
  });

  it('exactly spending the whole total is not over (no float noise)', () => {
    const r = computeAllocation(0.3, [seg('a', 0.1), seg('b', 0.2)]);
    expect(r.remaining).toBe(0);
    expect(r.over).toBe(false);
  });

  it('handles an empty bar and a zero total without dividing by zero', () => {
    expect(computeAllocation(0, [])).toMatchObject({ segments: [], remaining: 0, over: false, remainingFraction: 0 });
    const r = computeAllocation(0, [seg('a', 50)]);
    expect(r.over).toBe(true);
    expect(r.segments[0].fraction).toBe(1);
  });

  it('rejects negative or non-finite amounts instead of drawing nonsense', () => {
    expect(() => computeAllocation(100, [seg('a', -5)])).toThrow(RangeError);
    expect(() => computeAllocation(100, [seg('a', NaN)])).toThrow(RangeError);
    expect(() => computeAllocation(-1, [])).toThrow(RangeError);
    expect(() => computeAllocation(Infinity, [])).toThrow(RangeError);
  });
});
