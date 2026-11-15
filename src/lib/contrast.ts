// WCAG 2.1 contrast maths plus a tokens.css reader. Lives in src/lib (not in the test) so the
// same functions can later back a lint script; today only the contrast test uses it.

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Invalid hex colour: "${hex}"`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1..21. Symmetric: argument order does not matter. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** HSL hue in degrees [0, 360). Greys return 0; only meaningful for coloured inputs. */
export function hexToHue(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Shortest distance between two hues on the colour wheel, 0..180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export interface ParsedTokens {
  light: Record<string, string>;
  dark: Record<string, string>;
}

const BLOCK = /(:root(?:\[data-theme="dark"\])?)\s*\{([^}]*)\}/g;
// "--name: 243 245 247;" the channel triplet is the source of truth (Tailwind reads it);
// the trailing hex comment is documentation only and may drift, so it is never parsed.
const CHANNELS = /--([a-z0-9-]+)\s*:\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g;

const toHex = (n: number) => n.toString(16).padStart(2, '0');

/** Reads colour variables (name without "--" -> "#rrggbb") from the light and dark blocks. */
export function parseTokens(css: string): ParsedTokens {
  const out: ParsedTokens = { light: {}, dark: {} };
  for (const block of css.matchAll(BLOCK)) {
    const target = block[1].includes('data-theme') ? out.dark : out.light;
    for (const m of block[2].matchAll(CHANNELS)) {
      const [r, g, b] = [m[2], m[3], m[4]].map(Number);
      if ([r, g, b].some((c) => c > 255)) throw new Error(`Channel out of range in --${m[1]}`);
      target[m[1]] = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }
  return out;
}
