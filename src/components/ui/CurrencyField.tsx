import { forwardRef, useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react';
import { evaluateAmountExpression } from '../../domain';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatTHB } from '../../lib/money';
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
const HAS_OPERATOR_RE = /[+\-\u2212]/;

function format(value: number | null): string {
  return value === null ? '' : formatter.format(value);
}

interface EvaluatedText {
  value: number | null;
  exprError?: string;
  hasOperator: boolean;
}

function evaluateText(raw: string): EvaluatedText {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, hasOperator: false };

  const hasOperator = HAS_OPERATOR_RE.test(trimmed);
  try {
    const res = evaluateAmountExpression(trimmed);
    if ('value' in res && typeof res.value === 'number') {
      return { value: res.value / 100, hasOperator };
    }
    return { value: null, exprError: res.error ?? 'กรอกจำนวนเงินให้ถูกต้อง', hasOperator };
  } catch (err) {
    // Allow forms to keep working with single numbers if the Phase 2 domain module is still stubbed.
    if (err instanceof Error && err.message.startsWith('not implemented')) {
      const parsed = parseAmount(trimmed);
      if (parsed === null) {
        return { value: null, exprError: 'กรอกจำนวนเงินให้ถูกต้อง', hasOperator };
      }
      if (parsed <= 0) {
        return { value: null, exprError: 'ยอดต้องมากกว่า 0', hasOperator };
      }
      return { value: parsed, hasOperator };
    }
    return { value: null, exprError: 'กรอกจำนวนเงินให้ถูกต้อง', hasOperator };
  }
}

export const CurrencyField = forwardRef<HTMLInputElement, CurrencyFieldProps>(function CurrencyField(
  { label, value, onChange, error, onBlur, 'aria-describedby': describedByProp, ...rest },
  ref,
) {
  // The text is kept separately from the number: reformatting on every keystroke would move the caret and
  // fight the user ("12." or "45+" would collapse before they finish typing).
  const [text, setText] = useState(() => format(value));
  const [exprError, setExprError] = useState<string>();
  const isCoarsePointer = useMediaQuery('(pointer: coarse)');
  const previewId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const assignRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  // Follow outside changes (form reset, loading a record) without clobbering in-progress expressions.
  useEffect(() => {
    setText((current) => {
      if (evaluateText(current).value === value) return current;
      setExprError(undefined);
      return format(value);
    });
  }, [value]);

  const evaluated = evaluateText(text);
  const effectiveError = error ?? exprError;
  const showPreview = !effectiveError && evaluated.value !== null && evaluated.hasOperator;
  const describedBy = [describedByProp, showPreview ? previewId : undefined].filter(Boolean).join(' ') || undefined;

  const handleTextChange = (nextText: string) => {
    setText(nextText);
    const nextEval = evaluateText(nextText);
    setExprError(nextEval.exprError);
    onChange(nextEval.value);
  };

  const insertOperator = (op: '+' | '−') => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? text.length;
    const nextText = `${text.slice(0, start)}${op}${text.slice(end)}`;
    handleTextChange(nextText);

    if (input) {
      input.focus();
      const nextPos = start + op.length;
      if (typeof input.setSelectionRange === 'function') {
        requestAnimationFrame(() => {
          if (document.activeElement === input) {
            input.setSelectionRange(nextPos, nextPos);
          }
        });
      }
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <TextField
        ref={assignRef}
        label={label}
        error={effectiveError}
        aria-describedby={describedBy}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        onBlur={(e) => {
          const currentEval = evaluateText(text);
          // Leave expressions and invalid text as typed so users can inspect or fix them.
          if (!currentEval.hasOperator && currentEval.value !== null) {
            setText(format(currentEval.value));
          }
          onBlur?.(e);
        }}
        {...rest}
      />

      {showPreview && evaluated.value !== null ? (
        <p id={previewId} className="text-sm tabular-nums text-muted">
          = {formatTHB(evaluated.value)}
        </p>
      ) : null}

      {isCoarsePointer ? (
        <div className="flex items-center gap-2" role="group" aria-label="ปุ่มบวกลบ">
          <button
            type="button"
            aria-label="บวก"
            disabled={rest.disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertOperator('+')}
            className="pressable min-h-tap min-w-tap rounded-pill bg-stone-bg px-4 text-base font-medium text-stone-ink hover-fine:enabled:hover:opacity-80 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            +
          </button>
          <button
            type="button"
            aria-label="ลบ"
            disabled={rest.disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertOperator('−')}
            className="pressable min-h-tap min-w-tap rounded-pill bg-stone-bg px-4 text-base font-medium text-stone-ink hover-fine:enabled:hover:opacity-80 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            −
          </button>
        </div>
      ) : null}
    </div>
  );
});
