import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToHue, hueDistance, parseTokens } from '../lib/contrast';
import { THEME_COLOR } from '../lib/theme';

const ROOT = resolve(__dirname, '../..');
const css = readFileSync(resolve(ROOT, 'src/styles/tokens.css'), 'utf8');
const tokens = parseTokens(css);

const CORE_HUES = ['sky', 'apricot', 'teal', 'stone'] as const;
const SPARE_HUES = ['lilac', 'rose'] as const;
const ALL_HUES = [...CORE_HUES, ...SPARE_HUES];
const THEMES = ['light', 'dark'] as const;

describe('contrastRatio', () => {
  it('is 21:1 for black on white and symmetric', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 2);
  });
  it('is 1:1 for identical colours', () => {
    expect(contrastRatio('#3a3d40', '#3a3d40')).toBeCloseTo(1, 5);
  });
});

describe('parseTokens', () => {
  it('reads RGB channel triplets as lowercase #rrggbb, per theme', () => {
    expect(tokens.light.surface).toBe('#ffffff');
    expect(tokens.dark.ground).toBe('#111214');
  });
  it('ignores non-colour variables', () => {
    expect(tokens.light['radius-card']).toBeUndefined();
    expect(tokens.light['dur-press']).toBeUndefined();
  });
  it('defines every colour token in both themes', () => {
    expect(Object.keys(tokens.dark).sort()).toEqual(Object.keys(tokens.light).sort());
  });
});

describe.each(THEMES)('contrast guard (%s theme)', (theme) => {
  const t = tokens[theme];

  it('text on surface >= 4.5', () => {
    expect(contrastRatio(t.text, t.surface)).toBeGreaterThanOrEqual(4.5);
  });
  it('text on ground >= 4.5', () => {
    expect(contrastRatio(t.text, t.ground)).toBeGreaterThanOrEqual(4.5);
  });
  it('muted on surface >= 4.5', () => {
    expect(contrastRatio(t.muted, t.surface)).toBeGreaterThanOrEqual(4.5);
  });
  it('accent on surface >= 3', () => {
    expect(contrastRatio(t.accent, t.surface)).toBeGreaterThanOrEqual(3);
  });

  describe.each(ALL_HUES)('%s tile', (hue) => {
    it('ink on bg >= 4.5', () => {
      expect(contrastRatio(t[`${hue}-ink`], t[`${hue}-bg`])).toBeGreaterThanOrEqual(4.5);
    });
    it('mark on surface >= 3', () => {
      expect(contrastRatio(t[`${hue}-mark`], t.surface)).toBeGreaterThanOrEqual(3);
    });
  });
});

describe.each(THEMES)('spare hues (%s theme)', (theme) => {
  const t = tokens[theme];

  it.each(SPARE_HUES)('%s never lands in the violet/indigo band (250-290 deg)', (hue) => {
    for (const part of ['bg', 'ink', 'mark']) {
      const h = hexToHue(t[`${hue}-${part}`]);
      expect(h < 250 || h > 290, `${hue}-${part} hue ${h.toFixed(0)}`).toBe(true);
    }
  });

  it.each(SPARE_HUES)('%s mark is >= 40 deg from every other hue mark', (hue) => {
    const mine = hexToHue(t[`${hue}-mark`]);
    for (const other of ALL_HUES.filter((h) => h !== hue)) {
      const d = hueDistance(mine, hexToHue(t[`${other}-mark`]));
      expect(d, `${hue} vs ${other} = ${d.toFixed(0)} deg`).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('theme-color stays in sync with ground', () => {
  it.each(THEMES)('THEME_COLOR.%s equals the %s --ground token', (theme) => {
    expect(THEME_COLOR[theme]).toBe(tokens[theme].ground);
  });

  // The anti-flash script in index.html runs before any module loads, so it cannot import
  // THEME_COLOR and duplicates the hex values; this keeps the copy honest.
  it('index.html contains both THEME_COLOR hex values', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8').toLowerCase();
    expect(html).toContain(THEME_COLOR.light);
    expect(html).toContain(THEME_COLOR.dark);
  });
});
