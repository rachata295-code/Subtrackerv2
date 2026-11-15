import { formatTHB } from '../../lib/money';
import { thaiMonthShort } from '../../lib/thaiDate';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Money } from '../../components/ui/Money';
import { Pill } from '../../components/ui/Pill';
import type { FinanceData, Subscription } from '../../types/finance';
import { satangToBaht, subscriptionMonthlySatang, totalMonthlySubscriptionsSatang } from './billsLogic';

export interface SubscriptionsTabProps {
  data: FinanceData;
  onEdit: (sub: Subscription) => void;
}

function billingScheduleText(sub: Subscription): string {
  if (sub.frequency === 'yearly' && sub.billingMonth !== null) {
    return `ทุกวันที่ ${sub.billingDay} ${thaiMonthShort(sub.billingMonth - 1)}`;
  }
  return `ทุกวันที่ ${sub.billingDay}`;
}

export function SubscriptionsTab({ data, onEdit }: SubscriptionsTabProps) {
  const activeSubs = data.subscriptions
    .filter((s) => s.active)
    .sort((a, b) => subscriptionMonthlySatang(b) - subscriptionMonthlySatang(a) || a.name.localeCompare(b.name, 'th'));

  const inactiveSubs = data.subscriptions
    .filter((s) => !s.active)
    .sort((a, b) => subscriptionMonthlySatang(b) - subscriptionMonthlySatang(a) || a.name.localeCompare(b.name, 'th'));

  const totalMonthlySatang = totalMonthlySubscriptionsSatang(data.subscriptions);
  const salarySatang = data.settings.salary;
  const salaryPct = salarySatang > 0 ? ((totalMonthlySatang / salarySatang) * 100).toFixed(1) : null;

  return (
    <div className="flex flex-col gap-gap">
      <Card data-testid="subscriptions-summary">
        <p className="text-sm text-muted">รวมต่อเดือน</p>
        <div className="mt-0.5 flex items-baseline justify-between gap-3">
          <Money value={satangToBaht(totalMonthlySatang)} size="xl" />
          <p className="text-sm font-medium tabular-nums text-muted">
            {salaryPct !== null ? `${salaryPct}% ของเงินเดือน` : '—'}
          </p>
        </div>
      </Card>

      {activeSubs.length === 0 && inactiveSubs.length === 0 ? (
        <Card>
          <EmptyState message="ยังไม่มีรายการสมาชิก กด + เพื่อเพิ่มรายการแรก" />
        </Card>
      ) : (
        <Card padding="none" className="px-card py-1">
          {[...activeSubs, ...inactiveSubs].map((sub) => {
            const src = data.sources.find((s) => s.id === sub.sourceId);
            const pot = sub.potId ? data.pots.find((p) => p.id === sub.potId) : undefined;
            const monthlySatang = subscriptionMonthlySatang(sub);

            return (
              <button
                key={sub.id}
                type="button"
                data-testid={`subscription-item-${sub.id}`}
                onClick={() => onEdit(sub)}
                className={[
                  'pressable flex min-h-tap w-full items-center justify-between gap-3 border-b border-rule py-2.5 text-left last:border-b-0',
                  'hover-fine:hover:bg-stone-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
                  !sub.active ? 'opacity-60' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-text">{sub.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{billingScheduleText(sub)}</span>
                    {src ? <Pill hue={src.hue}>{src.name}</Pill> : null}
                    {pot ? <Pill hue={pot.hue}>{pot.name}</Pill> : null}
                    {!sub.active ? <Pill hue="stone">หยุดพัก</Pill> : null}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <Money value={satangToBaht(monthlySatang)} size="md" kind="spend" />
                  {sub.frequency === 'yearly' ? (
                    <p className="text-xs tabular-nums text-muted">{formatTHB(satangToBaht(sub.amount))}/ปี</p>
                  ) : (
                    <p className="text-xs text-muted">/เดือน</p>
                  )}
                </div>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
