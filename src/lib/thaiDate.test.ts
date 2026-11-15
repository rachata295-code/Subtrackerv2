import { describe, expect, it } from 'vitest';
import { thaiMonthShort } from './thaiDate';

describe('thaiMonthShort', () => {
  it('maps zero-based month indexes to Thai abbreviations', () => {
    expect(thaiMonthShort(0)).toBe('ม.ค.');
    expect(thaiMonthShort(3)).toBe('เม.ย.');
    expect(thaiMonthShort(10)).toBe('พ.ย.');
    expect(thaiMonthShort(11)).toBe('ธ.ค.');
  });

  it('has twelve distinct months', () => {
    const all = Array.from({ length: 12 }, (_, i) => thaiMonthShort(i));
    expect(new Set(all).size).toBe(12);
  });

  it.each([-1, 12, 1.5, NaN])('throws RangeError for %s', (bad) => {
    expect(() => thaiMonthShort(bad)).toThrow(RangeError);
  });
});
