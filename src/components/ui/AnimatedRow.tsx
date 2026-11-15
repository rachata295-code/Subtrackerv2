import type { HTMLAttributes } from 'react';

/** Equals --dur-press (140ms): the exit keyframes in motion.css. Owners unmount the row after this long. */
export const ROW_EXIT_MS = 140;

export interface AnimatedRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Row was created after first paint (user added it): fade in while rising 8px. Never set for the initial list. */
  entering?: boolean;
  /** Row is on its way out: fade out while lifting 4px. The owner removes it after ROW_EXIT_MS. */
  leaving?: boolean;
}

// Thin wrapper so every add/remove in the app shares one motion (spec 6); the keyframes live in motion.css.
export function AnimatedRow({ entering = false, leaving = false, className, ...rest }: AnimatedRowProps) {
  const classes = [entering ? 'row-enter' : '', leaving ? 'row-exit' : '', className].filter(Boolean).join(' ');
  return <div className={classes || undefined} data-leaving={leaving || undefined} {...rest} />;
}
