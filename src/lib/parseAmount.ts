// Digits with an optional single dot and at most 2 decimals. Either side of the dot may be empty
// ("12." and ".5" are valid while typing) but the whole string needs at least one digit (checked below).
const AMOUNT_RE = /^\d*\.?\d{0,2}$/;

/**
 * Parses user-typed money text into a number, or null when it is not a valid non-negative amount.
 * Strips the baht sign, thousands commas and whitespace first so pasted values like "฿1,381.93" work.
 * More than 2 decimals is rejected rather than rounded: silently changing what someone typed is worse than an error.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[฿,\s]/g, '');
  if (!/\d/.test(cleaned) || !AMOUNT_RE.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
