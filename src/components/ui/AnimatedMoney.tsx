import { useEffect, useState } from 'react';
import { Money, type MoneySize } from './Money';

export interface AnimatedMoneyProps {
  value: number;
  size?: MoneySize;
  /**
   * Announce changes from this component (default). Pass false when a parent live region already owns the
   * announcement, so a label can be read together with the amount and the amount is not read twice.
   */
  live?: boolean;
}

// Keep equal to --dur-base (240ms) in tokens.css: the old layer is dropped once its fade has finished.
// A timer (not animationend) so the layer is also removed when the animation never runs (reduced-motion engines, jsdom).
const FADE_MS = 240;

interface Shown {
  current: number;
  previous: number | null;
  /** Bumped on every change so React remounts the layers and the CSS animation restarts. */
  gen: number;
}

/**
 * A money figure that crossfades old to new when its value changes (motion.css: .money-out / .money-in).
 * Both layers share one grid cell, so the box is as wide as the wider of the two and nothing reflows mid-fade.
 * First paint is static: a figure that animates on page load would be motion nobody asked for.
 */
export function AnimatedMoney({ value, size = 'md', live = true }: AnimatedMoneyProps) {
  const [shown, setShown] = useState<Shown>({ current: value, previous: null, gen: 0 });

  // Adjusting state while rendering (instead of in an effect) means the old value is on screen in the very
  // same commit as the new one, so there is no frame where only the new value shows and the fade is skipped.
  // Object.is, not !==: NaN !== NaN is always true, which would re-set state on every render and loop forever.
  if (!Object.is(shown.current, value)) {
    setShown({ current: value, previous: shown.current, gen: shown.gen + 1 });
  }

  useEffect(() => {
    if (shown.previous === null) return;
    const t = setTimeout(() => setShown((s) => ({ ...s, previous: null })), FADE_MS);
    return () => clearTimeout(t);
  }, [shown.gen, shown.previous]);

  const animating = shown.previous !== null;
  return (
    // polite: the new amount is announced after a payment; the aria-hidden old layer is not read out.
    <span className="inline-grid text-right" aria-live={live ? 'polite' : undefined}>
      {animating ? (
        <span key={`out-${shown.gen}`} aria-hidden="true" className="money-out [grid-area:1/1]">
          <Money value={shown.previous} size={size} />
        </span>
      ) : null}
      <span key={`in-${shown.gen}`} className={`${animating ? 'money-in ' : ''}[grid-area:1/1]`}>
        <Money value={shown.current} size={size} />
      </span>
    </span>
  );
}
