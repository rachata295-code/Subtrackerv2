import { describe, expect, it } from 'vitest';
import { parseAmount } from './parseAmount';

describe('parseAmount', () => {
  it('parses thousands separators and decimals', () => {
    expect(parseAmount('1,381.93')).toBe(1381.93);
  });

  it('accepts commas only as thousands separators', () => {
    expect(parseAmount('1,381.93')).toBe(1381.93);
    expect(parseAmount('1381.93')).toBe(1381.93);
    expect(parseAmount('1,234,567')).toBe(1234567);
    // A comma anywhere else is more likely a decimal comma ("12,50" = 12.50 in many locales) than a thousand:
    // reading it as 1250 would silently misstate money, so it is an error instead.
    expect(parseAmount('12,50')).toBeNull();
    expect(parseAmount('1,2,3')).toBeNull();
    expect(parseAmount('1,23')).toBeNull();
    expect(parseAmount('1234,567')).toBeNull();
    expect(parseAmount(',500')).toBeNull();
    expect(parseAmount('1,000,')).toBeNull();
  });

  it('trims and strips baht sign and spaces', () => {
    expect(parseAmount(' ฿3,000 ')).toBe(3000);
    expect(parseAmount('1 000')).toBe(1000);
  });

  it('accepts one or two decimals, and a bare trailing or leading dot while typing', () => {
    expect(parseAmount('12.5')).toBe(12.5);
    expect(parseAmount('12.')).toBe(12);
    expect(parseAmount('.5')).toBe(0.5);
    expect(parseAmount('0')).toBe(0);
  });

  it('rejects more than 2 decimals', () => {
    expect(parseAmount('12.345')).toBeNull();
  });

  it('rejects non-numeric, empty and malformed input', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
    expect(parseAmount('.')).toBeNull();
    expect(parseAmount('1.2.3')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('12abc')).toBeNull();
    expect(parseAmount('1e3')).toBeNull();
  });
});
