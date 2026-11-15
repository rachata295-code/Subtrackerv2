import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `none` is for cards that hold full-bleed rows and pad them themselves. */
  padding?: 'md' | 'none';
}

// Surface lift comes from the surface/ground lightness step plus a 1px border, never a shadow (spec 5.5, 7).
// The border is part of the base so callers must not add their own, or it would double up.
export function Card({ padding = 'md', className, ...rest }: CardProps) {
  const classes = ['rounded-card border border-border bg-surface', padding === 'md' ? 'p-card' : '', className].filter(Boolean).join(' ');
  return <div className={classes} {...rest} />;
}
