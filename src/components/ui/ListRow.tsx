import type { ReactNode } from 'react';
import { Money, type MoneyKind } from './Money';

export interface ListRowProps {
  leading?: ReactNode;
  title: string;
  detail?: ReactNode;
  amount: number | null;
  amountKind?: MoneyKind;
  /** Emphasises the title (semibold), e.g. for the next payment due. */
  strong?: boolean;
  onClick?: () => void;
}

// Spans, not divs: when clickable the row is a <button>, and block elements inside a button are invalid HTML.
export function ListRow({ leading, title, detail, amount, amountKind, strong = false, onClick }: ListRowProps) {
  const inner = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      {/* min-w-0 lets this flex child shrink below its content width, which is what makes `truncate` work. */}
      <span className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-base ${strong ? 'font-semibold' : 'font-medium'} text-text`}>{title}</span>
        {detail ? <span className="block truncate text-sm text-muted">{detail}</span> : null}
      </span>
      {/* The amount never wraps or shrinks: a long title gives way, the money stays readable. */}
      <span className="shrink-0 whitespace-nowrap text-right">
        <Money value={amount} kind={amountKind} />
      </span>
    </>
  );

  const base = 'flex w-full min-h-tap items-center gap-3 border-b border-rule py-2 last:border-b-0';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} pressable hover-fine:hover:bg-stone-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2`}
      >
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}
