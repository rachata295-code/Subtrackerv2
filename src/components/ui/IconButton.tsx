import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required: an icon alone has no accessible name. */
  label: string;
  icon: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, className, type = 'button', ...rest },
  ref,
) {
  const classes = [
    'pressable inline-flex h-11 w-11 items-center justify-center rounded-tile text-text',
    'hover-fine:hover:bg-stone-bg disabled:opacity-50',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} type={type} aria-label={label} className={classes} {...rest}>
      {icon}
    </button>
  );
});
