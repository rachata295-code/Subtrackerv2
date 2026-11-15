import { splitTHB } from '../../lib/money';

export type MoneyKind = 'spend' | 'income' | 'neutral';
export type MoneySize = 'xl' | 'md' | 'sm';

interface MoneyProps {
  /** null (or a non-finite number) means "no data yet" and renders an em dash. */
  value: number | null;
  size?: MoneySize;
  kind?: MoneyKind;
  /** `inherit` adds no colour class so the amount takes the surrounding ink (Tile). Default `auto` applies the colour rules. */
  tone?: 'auto' | 'inherit';
}

// Sizes come from tailwind.config.ts fontSize tokens (spec 5.4: money-xl 36, money 17, small 14).
const SIZE_CLASS: Record<MoneySize, string> = {
  xl: 'text-money-xl font-semibold',
  md: 'text-money font-medium',
  sm: 'text-sm font-normal',
};

// Colour rules (spec 5.4): spending is ink, never red; `negative` is reserved for over-budget
// (a negative neutral amount); income is green with a leading +; empty and zero fade to muted.
function colourClass(value: number, kind: MoneyKind, isZero: boolean): string {
  if (isZero) return 'text-muted';
  if (kind === 'income' && value > 0) return 'text-positive';
  if (kind === 'neutral' && value < 0) return 'text-negative';
  return 'text-text';
}

export function Money({ value, size = 'md', kind = 'neutral', tone = 'auto' }: MoneyProps) {
  const base = `tabular-nums ${SIZE_CLASS[size]}`;

  if (value === null || !Number.isFinite(value)) {
    return <span className={tone === 'inherit' ? base : `${base} text-muted`}>—</span>;
  }

  const { sign, baht, satang } = splitTHB(value, { showPlus: kind === 'income' });
  // Judge zero on the formatted parts so 0.001 (shown as ฿0.00) fades like a true zero.
  const isZero = baht === '฿0' && satang === '.00';
  const colour = tone === 'inherit' ? '' : colourClass(value, kind, isZero);

  return (
    <span className={`${base} ${colour}`.trim()}>
      {sign}
      {baht}
      {/* Big numbers shrink the satang so the baht carries the weight (spec 5.4). */}
      <span className={size === 'xl' ? 'text-money font-medium text-muted' : undefined}>{satang}</span>
    </span>
  );
}
