import { describe, expect, it } from 'vitest';
import { payPeriod } from './index';

describe('payPeriod', () => {
  it('maps 2026-11-15 with payDay 10 to period 2026-11 (Nov 10 – Dec 9)', () => {
    expect(payPeriod('2026-11-15', 10)).toEqual({
      key: '2026-11',
      start: '2026-11-10',
      end: '2026-12-09',
    });
  });

  it('treats payDay itself as the first day of the new period', () => {
    expect(payPeriod('2026-11-10', 10)).toEqual({
      key: '2026-11',
      start: '2026-11-10',
      end: '2026-12-09',
    });
  });

  it('maps 2026-11-09 with payDay 10 to previous period 2026-10', () => {
    expect(payPeriod('2026-11-09', 10)).toEqual({
      key: '2026-10',
      start: '2026-10-10',
      end: '2026-11-09',
    });
  });

  it('crosses year boundary correctly for dates before January payDay', () => {
    expect(payPeriod('2026-01-05', 10)).toEqual({
      key: '2025-12',
      start: '2025-12-10',
      end: '2026-01-09',
    });
  });

  it('clamps payDay 31 in short months including February (non-leap and leap)', () => {
    // Non-leap Feb 2026: period starts Feb 28 and ends day before Mar 31.
    expect(payPeriod('2026-02-28', 31)).toEqual({
      key: '2026-02',
      start: '2026-02-28',
      end: '2026-03-30',
    });
    // Mid-Feb belongs to Jan 31 period ending day before Feb 28.
    expect(payPeriod('2026-02-15', 31)).toEqual({
      key: '2026-01',
      start: '2026-01-31',
      end: '2026-02-27',
    });
    // Leap-year Feb 2024: clamped to Feb 29.
    expect(payPeriod('2024-02-29', 31)).toEqual({
      key: '2024-02',
      start: '2024-02-29',
      end: '2024-03-30',
    });
    // 30-day April: clamped to Apr 30.
    expect(payPeriod('2026-04-30', 31)).toEqual({
      key: '2026-04',
      start: '2026-04-30',
      end: '2026-05-30',
    });
  });
});
