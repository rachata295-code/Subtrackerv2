import { describe, expect, it } from 'vitest';
import { evaluateAmountExpression } from './expression';

describe('SPEC §4 B1: evaluateAmountExpression', () => {
  it('SPEC §4 B1: evaluates single valid numbers into integer satang using parseAmount rules', () => {
    expect(evaluateAmountExpression('45')).toEqual({ value: 4_500 });
    expect(evaluateAmountExpression('1,381.93')).toEqual({ value: 138_193 });
    expect(evaluateAmountExpression(' ฿3,000 ')).toEqual({ value: 300_000 });
    expect(evaluateAmountExpression('12.5')).toEqual({ value: 1_250 });
    expect(evaluateAmountExpression('.5')).toEqual({ value: 50 });
  });

  it('SPEC §4 B1: evaluates addition expressions (45+60+35 -> 14000, 1,200+45.50 -> 124550)', () => {
    expect(evaluateAmountExpression('45+60+35')).toEqual({ value: 14_000 });
    expect(evaluateAmountExpression('1,200+45.50')).toEqual({ value: 124_550 });
    expect(evaluateAmountExpression(' 45 + 60 + 35 ')).toEqual({ value: 14_000 });
    expect(evaluateAmountExpression('0.1+0.2')).toEqual({ value: 30 });
  });

  it('SPEC §4 B1: evaluates subtraction with ASCII hyphen-minus (-) and Unicode minus (U+2212 −)', () => {
    expect(evaluateAmountExpression('120-15')).toEqual({ value: 10_500 });
    expect(evaluateAmountExpression('120\u221215')).toEqual({ value: 10_500 });
    expect(evaluateAmountExpression('1,000-250+50')).toEqual({ value: 80_000 });
  });

  it('SPEC §4 B1: returns error without throwing on incomplete expressions like 45+', () => {
    for (const incomplete of ['', '   ', '45+', '45-', '45\u2212', '+45', '45++60', '45+-10', '-']) {
      const res = evaluateAmountExpression(incomplete);
      expect(res.value).toBeUndefined();
      expect(typeof res.error).toBe('string');
      expect(res.error!.length).toBeGreaterThan(0);
    }
  });

  it('SPEC §4 B1: returns error "ยอดต้องมากกว่า 0" when result is <= 0', () => {
    expect(evaluateAmountExpression('0')).toEqual({ error: 'ยอดต้องมากกว่า 0' });
    expect(evaluateAmountExpression('120-120')).toEqual({ error: 'ยอดต้องมากกว่า 0' });
    expect(evaluateAmountExpression('50-60')).toEqual({ error: 'ยอดต้องมากกว่า 0' });
    expect(evaluateAmountExpression('50\u221260')).toEqual({ error: 'ยอดต้องมากกว่า 0' });
    expect(evaluateAmountExpression('-5')).toEqual({ error: 'ยอดต้องมากกว่า 0' });
  });

  it('SPEC §4 B1: rejects *, ×, /, ÷, parentheses, and invalid comma/decimal formats via parseAmount', () => {
    for (const invalid of [
      '45*2',
      '45×2',
      '100/2',
      '100÷2',
      '(45+60)',
      '12,50+10',
      '12.345+1',
      'abc+10',
    ]) {
      const res = evaluateAmountExpression(invalid);
      expect(res.value).toBeUndefined();
      expect(typeof res.error).toBe('string');
    }
  });
});
