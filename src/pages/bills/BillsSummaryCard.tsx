import { AnimatedMoney } from '../../components/ui/AnimatedMoney';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Pill } from '../../components/ui/Pill';
import type { FinanceData, ISODate } from '../../types/finance';
import { computeBillsCycleSummary, formatThaiDateShort, satangToBaht } from './billsLogic';

export interface BillsSummaryCardProps {
  data: FinanceData;
  today: ISODate;
}

export function BillsSummaryCard({ data, today }: BillsSummaryCardProps) {
  const summary = computeBillsCycleSummary(data, today);

  return (
    <Card data-testid="bills-summary-card" className="flex flex-col gap-3">
      <div>
        <h2 className="text-section font-semibold text-text">สรุปรอบนี้</h2>
        <p className="mt-0.5 text-xs text-muted">ยอดรวมต่อช่องทางในรอบบิลปัจจุบัน</p>
      </div>

      {summary.channels.length === 0 ? (
        <EmptyState message="ยังไม่มีช่องทางที่มีรอบบิล" />
      ) : (
        <>
          <div className="flex flex-col">
            {summary.channels.map((ch) => {
              const statusText = ch.paid
                ? 'จ่ายแล้ว'
                : ch.dueDate
                  ? `${ch.dueBy ? 'ภายใน' : 'ครบกำหนด'} ${formatThaiDateShort(ch.dueDate)}`
                  : 'ตัดจากบัญชี';

              return (
                <div
                  key={ch.source.id}
                  data-testid={`summary-channel-${ch.source.id}`}
                  className="flex min-h-tap items-center justify-between gap-3 border-b border-rule py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Pill hue={ch.source.hue}>{ch.source.name}</Pill>
                    </div>
                    <p className={`mt-1 text-xs ${ch.paid ? 'font-medium text-positive' : 'text-muted'}`}>
                      {statusText}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <AnimatedMoney value={satangToBaht(ch.amountSatang)} size="md" live={false} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5 border-t border-rule pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-text">ยอดรวมทั้งหมด</span>
              <div data-testid="summary-total" className="text-right">
                <AnimatedMoney value={satangToBaht(summary.totalSatang)} size="md" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted">ยังต้องจ่ายอีก</span>
              <div data-testid="summary-unpaid" className="text-right">
                <AnimatedMoney value={satangToBaht(summary.unpaidSatang)} size="md" />
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
