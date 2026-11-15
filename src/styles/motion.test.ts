import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read from disk: Vitest's CSS pipeline does not hand `?raw` the stylesheet text reliably.
const motionCss = readFileSync(join(process.cwd(), 'src/styles/motion.css'), 'utf8');

// jsdom evaluates neither @media (prefers-reduced-motion) nor real cascade order, so these pin the rules in the
// stylesheet text itself. They fail if someone deletes the reduced-motion fallback or lowers a selector's specificity.

/** Body of the first block whose selector list contains `selector`, searched from `from`. */
function block(css: string, selector: string, from = 0): string {
  const at = css.indexOf(selector, from);
  if (at < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf('{', at);
  return css.slice(open + 1, css.indexOf('}', open));
}

/** The text of every `@media (prefers-reduced-motion: reduce) { ... }` block, nesting-aware. */
function reducedMotionBlocks(css: string): string[] {
  const out: string[] = [];
  const marker = '@media (prefers-reduced-motion: reduce)';
  let at = css.indexOf(marker);
  while (at >= 0) {
    const open = css.indexOf('{', at);
    let depth = 1;
    let i = open + 1;
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    out.push(css.slice(open + 1, i - 1));
    at = css.indexOf(marker, i);
  }
  return out;
}

const reduced = reducedMotionBlocks(motionCss).join('\n');

describe('motion.css', () => {
  it('keeps press feedback under reduced motion: no movement, a short opacity change instead', () => {
    const base = block(reduced, '.pressable {');
    expect(base).toContain('transition: opacity var(--dur-press) var(--ease-out)');
    const active = block(reduced, ".pressable:active:not(:disabled)");
    expect(active).toContain('transform: none');
    expect(active).toContain('opacity: 0.7');
    // Disabled, aria-disabled and busy controls never look pressable, in either mode.
    for (const sel of motionCss.match(/\.pressable:active[^{]*/g) ?? []) {
      expect(sel).toContain(':not(:disabled)');
      expect(sel).toContain(":not([aria-disabled='true'])");
      expect(sel).toContain(":not([aria-busy='true'])");
    }
  });

  it('no longer carries the unused .press / .press-hover rules', () => {
    expect(motionCss).not.toMatch(/\.press(-hover)?[\s:{.,]/);
  });

  it('overrides the Vaul overlay with a selector more specific than Vaul\'s [data-vaul-overlay][data-vaul-snap-points=false]', () => {
    for (const state of ['open', 'closed']) {
      const selector = `[data-vaul-overlay][data-vaul-snap-points][data-state='${state}']`;
      expect(motionCss).toContain(selector);
      // Three attributes (0,3,0) beat Vaul's two (0,2,0) whatever the stylesheet order.
      expect(selector.match(/\[/g)).toHaveLength(3);
    }
    expect(block(motionCss, "[data-vaul-overlay][data-vaul-snap-points][data-state='closed']")).toContain('animation-duration: 240ms');
  });

  it('defines row enter (rise 8px, --dur-fast) and a faster exit (lift 4px, --dur-press)', () => {
    const enter = block(motionCss, '.row-enter {');
    const exit = block(motionCss, '.row-exit {');
    expect(enter).toContain('var(--dur-fast)');
    expect(exit).toContain('var(--dur-press)');
    expect(motionCss).toMatch(/@keyframes row-in[\s\S]*?translateY\(8px\)/);
    expect(motionCss).toMatch(/@keyframes row-out[\s\S]*?translateY\(-4px\)/);
    expect(exit).toContain('pointer-events: none');
  });

  it('falls back to opacity-only row motion under reduced motion', () => {
    expect(block(reduced, '.row-enter {')).toContain('animation-name: row-fade-in');
    expect(block(reduced, '.row-exit {')).toContain('animation-name: row-fade-out');
    const fades = motionCss.match(/@keyframes row-fade-(in|out)\s*\{[\s\S]*?\n\}/g) ?? [];
    expect(fades).toHaveLength(2);
    for (const f of fades) expect(f).not.toContain('transform');
  });
});
