import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const mainTsx = readFileSync(join(root, 'src/main.tsx'), 'utf8');
const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8');
const fontsCssPath = join(root, 'src/styles/fonts.css');

describe('font subsetting & PWA precache config', () => {
  it('main.tsx imports ./styles/fonts.css instead of full @fontsource weight bundles', () => {
    expect(mainTsx).toContain("import './styles/fonts.css'");
    expect(mainTsx).not.toMatch(/@fontsource\/(manrope|anuphan)\/(400|500|600)\.css/);
  });

  it('fonts.css declares only Anuphan (thai + latin) and Manrope (latin) at 400/500/600 in woff2', () => {
    expect(existsSync(fontsCssPath)).toBe(true);
    const fontsCss = readFileSync(fontsCssPath, 'utf8');

    const faces = fontsCss.match(/@font-face\s*\{[\s\S]*?\}/g) ?? [];
    expect(faces).toHaveLength(9);

    for (const weight of ['400', '500', '600']) {
      const anuphanThai = faces.find(
        (b) =>
          b.includes("font-family: 'Anuphan'") &&
          b.includes(`font-weight: ${weight}`) &&
          b.includes(`anuphan-thai-${weight}-normal.woff2`),
      );
      expect(anuphanThai, `missing Anuphan thai ${weight}`).toBeDefined();
      expect(anuphanThai).toContain('U+0E01-0E5B');
      expect(anuphanThai).toContain('font-display: swap');

      const anuphanLatin = faces.find(
        (b) =>
          b.includes("font-family: 'Anuphan'") &&
          b.includes(`font-weight: ${weight}`) &&
          b.includes(`anuphan-latin-${weight}-normal.woff2`),
      );
      expect(anuphanLatin, `missing Anuphan latin ${weight}`).toBeDefined();
      expect(anuphanLatin).toContain('U+0000-00FF');
      expect(anuphanLatin).toContain('font-display: swap');

      const manropeLatin = faces.find(
        (b) =>
          b.includes("font-family: 'Manrope'") &&
          b.includes(`font-weight: ${weight}`) &&
          b.includes(`manrope-latin-${weight}-normal.woff2`),
      );
      expect(manropeLatin, `missing Manrope latin ${weight}`).toBeDefined();
      expect(manropeLatin).toContain('U+0000-00FF');
      expect(manropeLatin).toContain('font-display: swap');
    }

    const joinedFaces = faces.join('\n');
    expect(joinedFaces).not.toMatch(/cyrillic|greek|vietnamese|latin-ext/);
    expect(joinedFaces).not.toMatch(/\.woff['")]/);
  });

  it('vite.config.ts limits workbox precache to used font subsets', () => {
    expect(viteConfig).not.toContain('**/*.{js,css,html,woff2,svg,png}');
    expect(viteConfig).toContain('anuphan-{thai,latin}');
    expect(viteConfig).toContain('manrope-latin');
    expect(viteConfig).toContain('globIgnores');
  });
});
