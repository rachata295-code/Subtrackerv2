import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Money } from './ui/Money';
import { forecast } from '../domain';
import {
  daysSinceBalanceCheckLabel,
  diffDays,
  isNotImplementedError,
  latestBalanceCheckForSource,
  pickDefaultBankSource,
} from '../pages/plan/planUtils';
import type { FinanceData, Forecast, ISODate } from '../types/finance';

export interface AvailableCardProps {
  data: FinanceData;
  today: ISODate;
  className?: string;
}

export function AvailableCard({ data, today, className = 'order-1' }: AvailableCardProps) {
  const bank = pickDefaultBankSource(data);
  if (!bank) return null;

  let fc: Forecast;
  try {
    fc = forecast(data, bank.id, today);
  } catch (err) {
    if (isNotImplementedError(err)) return null;
    return null;
  }

  const latestCheck = latestBalanceCheckForSource(data.balanceChecks, bank.id);
  const daysSince = latestCheck ? diffDays(latestCheck.checkedOn, today) : null;
  const needsCheck = daysSince === null || daysSince > 7;
  const checkText = daysSinceBalanceCheckLabel(latestCheck?.checkedOn ?? null, today);

  return (
    <Link
      to="/plan"
      data-testid="available-card"
      className={[
        'pressable flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-card',
        'hover-fine:hover:bg-stone-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted">ใช้ได้จริง</span>
          {needsCheck ? (
            <span className="inline-flex items-center rounded-pill bg-apricot-bg px-2 py-0.5 text-xs font-medium text-apricot-ink">
              ถึงเวลาเช็กยอดแล้ว
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted">{`${bank.name} · ${checkText}`}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Money value={fc.available / 100} size="md" />
        <ChevronRight size={18} strokeWidth={1.6} aria-hidden="true" className="text-muted" />
      </div>
    </Link>
  );
}
