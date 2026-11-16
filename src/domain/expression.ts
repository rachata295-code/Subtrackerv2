import { parseAmount } from '../lib/parseAmount';
import type { AmountExpressionResult, Satang } from '../types/finance';

export type { AmountExpressionResult };

const OPERATOR_RE = /([+\-\u2212])/;

/**
 * Evaluates a '+' / '-' / '−' (U+2212) amount expression into integer satang or a Thai error (SPEC §4 B1 & §6).
 * Each numeric term is validated through `parseAmount` and converted to integer satang before arithmetic
 * so decimal additions never suffer from IEEE-754 floating-point drift.
 */
export function evaluateAmountExpression(text: string): AmountExpressionResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: 'กรอกจำนวนเงินให้ถูกต้อง' };
  }

  // Handle a single negative number like "-5" as <= 0 so callers get the expected non-positive error.
  if (/^[-\u2212]/.test(trimmed)) {
    const rest = trimmed.slice(1).trim();
    if (!rest || OPERATOR_RE.test(rest)) {
      return { error: 'กรอกจำนวนเงินให้ถูกต้อง' };
    }
    const parsedRest = parseAmount(rest);
    if (parsedRest === null) {
      return { error: 'กรอกจำนวนเงินให้ถูกต้อง' };
    }
    return { error: 'ยอดต้องมากกว่า 0' };
  }

  const parts = trimmed.split(OPERATOR_RE);
  // Splitting with a capturing group yields [term0, op1, term1, op2, term2, ...] with odd length.
  if (parts.length % 2 === 0) {
    return { error: 'กรอกจำนวนเงินให้ถูกต้อง' };
  }

  let total: Satang = 0;

  for (let i = 0; i < parts.length; i += 2) {
    const rawTerm = parts[i]?.trim() ?? '';
    if (!rawTerm) {
      return { error: 'กรอกจำนวนเงินให้ถูกต้อง' };
    }

    const parsedBaht = parseAmount(rawTerm);
    if (parsedBaht === null) {
      return { error: 'กรอกจำนวนเงินให้ถูกต้อง' };
    }

    const termSatang = Math.round(parsedBaht * 100);
    if (i === 0) {
      total = termSatang;
    } else {
      const op = parts[i - 1];
      if (op === '+') {
        total += termSatang;
      } else {
        total -= termSatang;
      }
    }
  }

  if (total <= 0) {
    return { error: 'ยอดต้องมากกว่า 0' };
  }

  return { value: total };
}
