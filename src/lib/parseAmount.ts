// Digits with an optional single dot and at most 2 decimals. Either side of the dot may be empty
// ("12." and ".5" are valid while typing) but the whole string needs at least one digit (checked below).
const PLAIN_RE = /^\d*\.?\d{0,2}$/;
// The same, but with commas, which are only valid as thousands separators: 1-3 leading digits, then groups of 3.
const GROUPED_RE = /^\d{1,3}(,\d{3})+(\.\d{0,2})?$/;

/**
 * Parses user-typed money text into a number, or null when it is not a valid non-negative amount.
 * Strips the baht sign and whitespace first so pasted values like "฿1,381.93" work.
 * Commas are accepted only as thousands separators: "12,50" is null rather than 1250, because a decimal comma
 * read as a thousands separator would silently change the amount by 100x.
 * More than 2 decimals is rejected rather than rounded: silently changing what someone typed is worse than an error.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[฿\s]/g, '');
  if (!/\d/.test(cleaned)) return null;
  const valid = cleaned.includes(',') ? GROUPED_RE.test(cleaned) : PLAIN_RE.test(cleaned);
  if (!valid) return null;
  const n = Number(cleaned.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
