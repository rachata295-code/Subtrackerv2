import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';
import { parseAmount } from '../../lib/parseAmount';
import { TextField } from './TextField';

export interface CurrencyFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}

const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function format(value: number | null): string {
  return value === null ? '' : formatter.format(value);
}

export const CurrencyField = forwardRef<HTMLInputElement, CurrencyFieldProps>(function CurrencyField(
  { label, value, onChange, error, onBlur, ...rest },
  ref,
) {
  // The text is kept separately from the number: reformatting on every keystroke would move the caret and
  // fight the user ("12." would collapse to "12" before they could type the decimals).
  const [text, setText] = useState(() => format(value));

  // Follow outside changes (form reset, loading a record) but not our own: those already match parseAmount(text).
  useEffect(() => {
    setText((current) => (parseAmount(current) === value ? current : format(value)));
  }, [value]);

  return (
    <TextField
      ref={ref}
      label={label}
      error={error}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseAmount(e.target.value));
      }}
      onBlur={(e) => {
        const parsed = parseAmount(text);
        // Unparsable text is left as typed so the user can see and fix it; the parent shows the error.
        if (parsed !== null) setText(format(parsed));
        onBlur?.(e);
      }}
      {...rest}
    />
  );
});
