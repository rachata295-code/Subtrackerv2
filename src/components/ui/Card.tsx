import type { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `none` is for cards that hold full-bleed rows and pad them themselves. */
  padding?: 'md' | 'none';
}

// Surface lift comes from the surface/ground lightness step, never a shadow (spec 5.5).
export function Card({ padding = 'md', className, ...rest }: CardProps) {
  const classes = ['rounded-card bg-surface', padding === 'md' ? 'p-card' : '', className].filter(Boolean).join(' ');
  return <div className={classes} {...rest} />;
}
