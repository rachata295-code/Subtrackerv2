import type { AmountExpressionResult } from '../types/finance';

export type { AmountExpressionResult };

/** Evaluates a '+' / '-' amount expression into integer satang or a Thai error (SPEC §4 B1 & §6). */
export function evaluateAmountExpression(text: string): AmountExpressionResult {
  void text;
  throw new Error('not implemented: evaluateAmountExpression');
}
