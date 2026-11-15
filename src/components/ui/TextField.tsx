import { forwardRef, useId, type InputHTMLAttributes } from 'react';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, id, className, 'aria-describedby': describedByProp, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  // Merge rather than overwrite so a caller's own hint text stays announced next to the error.
  const describedBy = [describedByProp, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        // text-base = 16px: below that iOS Safari zooms the page on focus. h-11 meets the 44px tap target.
        className={[
          'h-11 w-full rounded-tile border bg-surface px-3 text-base text-text placeholder:text-muted',
          'disabled:opacity-50',
          error ? 'border-negative' : 'border-control',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
      {/* The message is text, not just a red border, so colour is never the only error signal. */}
      {error ? (
        <p id={errorId} className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
});
