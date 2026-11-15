import { thaiMonthShort } from '../../lib/thaiDate';

export interface DateBadgeProps {
  day: number;
  /** Zero-based, like Date#getMonth. */
  month: number;
  /** Shows "≤" before the day for deadlines ("pay by the 10th"). */
  dueBy?: boolean;
}

export function DateBadge({ day, month, dueBy = false }: DateBadgeProps) {
  return (
    <span className="flex min-h-tap min-w-tap flex-col items-center justify-center rounded-tile bg-stone-bg px-1 text-stone-ink">
      <span className="text-base font-semibold leading-5 tabular-nums">
        {dueBy ? '≤' : ''}
        {day}
      </span>
      <span className="text-xs font-medium leading-4">{thaiMonthShort(month)}</span>
    </span>
  );
}
