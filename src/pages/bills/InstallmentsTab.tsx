import { AnimatedRow } from '../../components/ui/AnimatedRow';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Money } from '../../components/ui/Money';
import { Pill } from '../../components/ui/Pill';
import type { FinanceData, ISODate, Installment } from '../../types/finance';
import {
  formatThaiDateFull,
  getInstallmentProgress,
  parseIsoDate,
  resolvePlayPot,
  satangToBaht,
} from './billsLogic';
import { useAnimatedItems } from './useAnimatedItems';

export interface InstallmentsTabProps {
  data: FinanceData;
  today: ISODate;
  onEdit: (inst: Installment) => void;
}

export function InstallmentsTab({ data, today, onEdit }: InstallmentsTabProps) {
  const playPot = resolvePlayPot(data.pots);
  const animatedInstallments = useAnimatedItems(data.installments);

  if (animatedInstallments.length === 0) {
    return (
      <Card>
        <EmptyState message="ยังไม่มีรายการผ่อน กด + เพื่อเพิ่มรายการแรก" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-gap">
      {animatedInstallments.map(({ item: inst, entering, leaving }) => {
        const src = data.sources.find((s) => s.id === inst.sourceId);
        const progress = getInstallmentProgress(inst, today);
        const isCountedInPlay = inst.potId !== null && (playPot ? inst.potId === playPot.id : true);
        const assignedPot = inst.potId ? data.pots.find((p) => p.id === inst.potId) : undefined;
        const potBadgeLabel = isCountedInPlay ? 'นับในใช้ตามใจ' : assignedPot ? assignedPot.name : 'แยก';
        const potBadgeHue = isCountedInPlay ? (playPot?.hue ?? 'teal') : (assignedPot?.hue ?? 'stone');
        const cutDay = parseIsoDate(inst.firstChargeDate).day;

        return (
          <AnimatedRow key={inst.id} entering={entering} leaving={leaving}>
            <Card padding="none">
              <button
                type="button"
                data-testid={`installment-item-${inst.id}`}
                onClick={() => onEdit(inst)}
                className="pressable flex min-h-tap w-full flex-col gap-3 rounded-card p-card text-left hover-fine:hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4"
              >
                <span className="hidden shrink-0 text-sm tabular-nums text-muted lg:inline">
                  {`ทุกวันที่ ${cutDay}`}
                </span>

                <div className="flex items-start justify-between gap-3 lg:min-w-0 lg:flex-1 lg:items-center">
                  <div className="min-w-0 flex-1 lg:flex lg:flex-wrap lg:items-center lg:gap-x-2.5 lg:gap-y-1">
                    <p className="truncate text-section font-semibold text-text lg:text-base">
                      {inst.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 lg:mt-0 lg:shrink-0">
                      {src ? <Pill hue={src.hue}>{src.name}</Pill> : null}
                      <Pill hue={potBadgeHue}>{potBadgeLabel}</Pill>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-muted lg:text-xs">
                    งวด {progress.currentN}/{progress.count}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-rule pt-2.5 text-sm lg:flex lg:shrink-0 lg:flex-col lg:items-end lg:gap-0.5 lg:border-t-0 lg:pt-0">
                  <div className="lg:order-1 lg:text-right">
                    <p className="text-xs text-muted lg:hidden">ต่องวด</p>
                    <Money value={satangToBaht(inst.perInstallment)} size="md" kind="spend" />
                  </div>
                  <div className="contents lg:order-2 lg:flex lg:items-center lg:gap-2 lg:text-xs lg:text-muted">
                    <div className="lg:flex lg:items-baseline lg:gap-1">
                      <p className="text-xs text-muted">เหลือรวม</p>
                      <Money value={satangToBaht(progress.remainingSatang)} size="sm" />
                    </div>
                    <span className="hidden text-muted lg:inline" aria-hidden="true">·</span>
                    <div className="text-right lg:flex lg:items-baseline lg:gap-1">
                      <p className="text-xs text-muted">วันจบ</p>
                      <p className="text-sm font-medium tabular-nums text-text lg:text-xs lg:font-normal lg:text-muted">{formatThaiDateFull(progress.endDate)}</p>
                    </div>
                  </div>
                </div>
              </button>
            </Card>
          </AnimatedRow>
        );
      })}
    </div>
  );
}
