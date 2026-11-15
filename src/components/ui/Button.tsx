import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

// Hover is gated by hover-fine so touch devices never get a stuck hover state.
const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover-fine:hover:opacity-90',
  secondary: 'bg-stone-bg text-stone-ink hover-fine:hover:opacity-80',
  ghost: 'bg-transparent text-accent hover-fine:hover:bg-stone-bg',
  // negative is reserved for destructive/over-budget actions (spec 5.4).
  danger: 'bg-negative text-on-accent hover-fine:hover:opacity-90',
};

// Both heights meet the 44px tap target.
const SIZE_CLASS: Record<ButtonSize, string> = {
  md: 'h-11 px-4',
  lg: 'h-12 px-5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size = 'md', loading = false, disabled, className, type = 'button', children, ...rest },
  ref,
) {
  // While loading the button is also disabled: that blocks double submits without a handler guard.
  const isDisabled = disabled || loading;
  const classes = [
    'pressable inline-flex items-center justify-center rounded-tile text-base font-medium',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
    SIZE_CLASS[size],
    VARIANT_CLASS[variant],
    // The label stays visible while loading so the button does not change width.
    loading ? 'cursor-wait opacity-70' : 'disabled:opacity-50',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} type={type} className={classes} disabled={isDisabled} aria-busy={loading || undefined} {...rest}>
      {children}
    </button>
  );
});
