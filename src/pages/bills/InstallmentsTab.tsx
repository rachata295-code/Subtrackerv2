import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Money } from '../../components/ui/Money';
import { Pill } from '../../components/ui/Pill';
import type { FinanceData, ISODate, Installment } from '../../types/finance';
import { formatThaiDateFull, getInstallmentProgress, resolvePlayPot, satangToBaht } from './billsLogic';

export interface InstallmentsTabProps {
  data: FinanceData;
  today: ISODate;
  onEdit: (inst: Installment) => void;
}

export function InstallmentsTab({ data, today, onEdit }: InstallmentsTabProps) {
  const playPot = resolvePlayPot(data.pots);

  if (data.installments.length === 0) {
    return (
      <Card>
        <EmptyState message="ยังไม่มีรายการผ่อน กด + เพื่อเพิ่มรายการแรก" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-gap">
      {data.installments.map((inst) => {
        const src = data.sources.find((s) => s.id === inst.sourceId);
        const progress = getInstallmentProgress(inst, today);
        const isCountedInPlay = inst.potId !== null && (playPot ? inst.potId === playPot.id : true);
        const assignedPot = inst.potId ? data.pots.find((p) => p.id === inst.potId) : undefined;
        const potBadgeLabel = isCountedInPlay ? 'นับในใช้ตามใจ' : assignedPot ? assignedPot.name : 'แยก';
        const potBadgeHue = isCountedInPlay ? (playPot?.hue ?? 'teal') : (assignedPot?.hue ?? 'stone');

        return (
          <Card key={inst.id} padding="none">
            <button
              type="button"
              data-testid={`installment-item-${inst.id}`}
              onClick={() => onEdit(inst)}
              className="pressable flex min-h-tap w-full flex-col gap-3 rounded-card p-card text-left hover-fine:hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-section font-semibold text-text">{inst.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {src ? <Pill hue={src.hue}>{src.name}</Pill> : null}
                    <Pill hue={potBadgeHue}>{potBadgeLabel}</Pill>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-muted">
                  งวด {progress.currentN}/{progress.count}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t border-rule pt-2.5 text-sm">
                <div>
                  <p className="text-xs text-muted">ต่องวด</p>
                  <Money value={satangToBaht(inst.perInstallment)} size="md" kind="spend" />
                </div>
                <div>
                  <p className="text-xs text-muted">เหลือรวม</p>
                  <Money value={satangToBaht(progress.remainingSatang)} size="md" />
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">วันจบ</p>
                  <p className="text-sm font-medium tabular-nums text-text">{formatThaiDateFull(progress.endDate)}</p>
                </div>
              </div>
            </button>
          </Card>
        );
      })}
    </div>
  );
}
