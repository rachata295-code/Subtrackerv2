import { describe, expect, it } from 'vitest';
import { formatTHB, splitTHB } from './money';

const MINUS = '−';

describe('formatTHB', () => {
  it('formats baht with two decimals', () => {
    expect(formatTHB(662.07)).toBe('฿662.07');
    expect(formatTHB(1381.93)).toBe('฿1,381.93');
    expect(formatTHB(50)).toBe('฿50.00');
  });
  it('groups thousands with Latin digits', () => {
    expect(formatTHB(1234567.891)).toBe('฿1,234,567.89');
  });
  it('rounds half up despite binary float error', () => {
    expect(formatTHB(0.005)).toBe('฿0.01');
    // 1.005 is stored as 1.00499999999999989...; naive toFixed/Math.round gives 1.00.
    expect(formatTHB(1.005)).toBe('฿1.01');
    expect(formatTHB(2.675)).toBe('฿2.68');
  });
  it('uses U+2212 for negatives, with the sign before the symbol', () => {
    expect(formatTHB(-458.93)).toBe(`${MINUS}฿458.93`);
    expect(formatTHB(-50)).toBe(`${MINUS}฿50.00`);
    expect(formatTHB(-458.93)).not.toContain('-');
  });
  it('shows zero without a sign, including negative zero and sub-satang noise', () => {
    expect(formatTHB(0)).toBe('฿0.00');
    expect(formatTHB(-0)).toBe('฿0.00');
    expect(formatTHB(-0.001)).toBe('฿0.00');
  });
  it('refuses non-finite or unrepresentable amounts instead of printing garbage', () => {
    expect(() => formatTHB(NaN)).toThrow(RangeError);
    expect(() => formatTHB(Infinity)).toThrow(RangeError);
    expect(() => formatTHB(1e20)).toThrow(RangeError);
  });
});

describe('splitTHB', () => {
  it('splits baht and satang', () => {
    expect(splitTHB(662.07)).toEqual({ sign: '', baht: '฿662', satang: '.07' });
    expect(splitTHB(1234567.891)).toEqual({ sign: '', baht: '฿1,234,567', satang: '.89' });
  });
  it('keeps the trailing zero in satang', () => {
    expect(splitTHB(1234.5)).toEqual({ sign: '', baht: '฿1,234', satang: '.50' });
  });
  it('carries a rounding overflow into baht', () => {
    expect(splitTHB(0.999)).toEqual({ sign: '', baht: '฿1', satang: '.00' });
  });
  it('puts the minus in sign', () => {
    expect(splitTHB(-458.93)).toEqual({ sign: MINUS, baht: '฿458', satang: '.93' });
  });
  it('gives zero no sign', () => {
    expect(splitTHB(0)).toEqual({ sign: '', baht: '฿0', satang: '.00' });
    expect(splitTHB(-0.001).sign).toBe('');
  });
  it('adds + for positive amounts only when asked', () => {
    expect(splitTHB(100, { showPlus: true }).sign).toBe('+');
    expect(splitTHB(100).sign).toBe('');
    expect(splitTHB(0, { showPlus: true }).sign).toBe('');
    expect(splitTHB(-5, { showPlus: true }).sign).toBe(MINUS);
  });
});
