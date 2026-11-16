import { useMemo } from 'react';
import {
  buildCategoryColorMap,
  CategorySpendChart,
  SpendingHistoryChart,
} from '../../components/charts';
import { AnimatedMoney } from '../../components/ui/AnimatedMoney';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { SelectField, type SelectOption } from '../../components/ui/SelectField';
import { payPeriod, spendingByCategory, spendingHistory } from '../../domain';
import { formatTHB } from '../../lib/money';
import type { FinanceData, ISODate, PeriodKey, PeriodSpending, SummaryCategory } from '../../types/finance';
import {
  formatPeriodMonthYear,
  formatThaiShort,
  getPeriodRange,
  getPreviousPeriodKey,
} from './entriesUtils';

export interface EntriesSummaryViewProps {
  data: FinanceData;
  today: ISODate;
  selectedPeriodKey: PeriodKey;
  onSelectPeriod: (periodKey: PeriodKey) => void;
  onSelectCategory: (category: SummaryCategory) => void;
}

type DomainResult =
  | {
      ok: true;
      selectedSummary: PeriodSpending;
      prevSummary: PeriodSpending;
      history: PeriodSpending[];
    }
  | { ok: false; errorMessage: string };

function formatComparison(currentTotal: number, prevTotal: number): string | null {
  if (prevTotal === 0) {
    return currentTotal > 0 ? 'ยังไม่มีข้อมูลรอบก่อน' : null;
  }
  const diff = currentTotal - prevTotal;
  if (diff === 0) return 'เท่ากับรอบก่อน';
  const formatted = formatTHB(diff / 100);
  return diff > 0 ? `+${formatted} จากรอบก่อน` : `${formatted} จากรอบก่อน`;
}

export function EntriesSummaryView({
  data,
  today,
  selectedPeriodKey,
  onSelectPeriod,
  onSelectCategory,
}: EntriesSummaryViewProps) {
  const payDay = data.settings.payDay;
  const currentPeriodKey = useMemo(() => payPeriod(today, payDay).key, [today, payDay]);
  const prevPeriodKey = useMemo(
    () => getPreviousPeriodKey(selectedPeriodKey, payDay),
    [selectedPeriodKey, payDay],
  );

  const periodOptions: SelectOption[] = useMemo(() => {
    const keys: PeriodKey[] = [];
    let cursor = currentPeriodKey;
    for (let i = 0; i < 6; i++) {
      keys.push(cursor);
      cursor = getPreviousPeriodKey(cursor, payDay);
    }
    if (!keys.includes(selectedPeriodKey)) {
      keys.push(selectedPeriodKey);
    }
    return keys.map((key, idx) => {
      const range = getPeriodRange(key, payDay);
      const rangeText = `${formatThaiShort(range.start)} – ${formatThaiShort(range.end)}`;
      const prefix = idx === 0 ? 'รอบนี้' : formatPeriodMonthYear(key);
      return {
        value: key,
        label: `${prefix} (${rangeText})`,
      };
    });
  }, [currentPeriodKey, payDay, selectedPeriodKey]);

  const result: DomainResult = useMemo(() => {
    try {
      const selectedSummary = spendingByCategory(data, selectedPeriodKey);
      const prevSummary = spendingByCategory(data, prevPeriodKey);
      const history = spendingHistory(data, currentPeriodKey, 6);
      return { ok: true, selectedSummary, prevSummary, history };
    } catch (err) {
      const detail = err instanceof Error && err.message.trim() ? `: ${err.message}` : '';
      return { ok: false, errorMessage: `ไม่สามารถคำนวณสรุปการใช้จ่ายได้${detail}` };
    }
  }, [data, selectedPeriodKey, prevPeriodKey, currentPeriodKey]);

  if (!result.ok) {
    return (
      <Card className="mt-4" role="alert">
        <p className="text-sm text-negative">{result.errorMessage}</p>
      </Card>
    );
  }

  const { selectedSummary, prevSummary, history } = result;
  const colorMap = buildCategoryColorMap(history, selectedSummary);
  const hasAnyData =
    selectedSummary.total > 0 ||
    selectedSummary.saved > 0 ||
    history.some((p) => p.total > 0 || p.saved > 0);
  const comparison = formatComparison(selectedSummary.total, prevSummary?.total ?? 0);

  return (
    <div className="mt-4 space-y-gap">
      <Card className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted">ยอดใช้รวม</p>
            <div data-testid="summary-total" className="mt-0.5">
              <AnimatedMoney value={selectedSummary.total / 100} size="xl" />
            </div>
            {comparison ? <p className="mt-0.5 text-sm text-muted">{comparison}</p> : null}
          </div>
          <div className="sm:w-64">
            <SelectField
              label="รอบเงินเดือน"
              options={periodOptions}
              value={selectedPeriodKey}
              onChange={(e) => onSelectPeriod(e.target.value)}
            />
          </div>
        </div>

        {selectedSummary.saved > 0 || selectedSummary.unknown > 0 ? (
          <div className="space-y-1.5 border-t border-rule pt-3">
            {selectedSummary.saved > 0 ? (
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted">เก็บรอบนี้</span>
                <span data-testid="summary-saved">
                  <AnimatedMoney value={selectedSummary.saved / 100} size="sm" live={false} />
                </span>
              </div>
            ) : null}
            {selectedSummary.unknown > 0 ? (
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-muted">ลืมจด</span>
                <span data-testid="summary-unknown">
                  <AnimatedMoney value={selectedSummary.unknown / 100} size="sm" live={false} />
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {!hasAnyData ? (
        <Card>
          <EmptyState message="ยังไม่มีข้อมูลการใช้จ่าย" />
        </Card>
      ) : (
        <div
          data-testid="summary-charts-grid"
          className="grid grid-cols-1 gap-gap lg:grid-cols-2 lg:items-start lg:gap-6"
        >
          <Card>
            <section aria-labelledby="summary-categories-heading">
              <h2 id="summary-categories-heading" className="mb-2 text-section font-semibold text-text">
                แยกตามหมวด
              </h2>
              {selectedSummary.categories.length === 0 || selectedSummary.total === 0 ? (
                <EmptyState message="ยังไม่มีการใช้จ่ายในรอบนี้" />
              ) : (
                <CategorySpendChart
                  categories={selectedSummary.categories}
                  colorMap={colorMap}
                  onSelectCategory={onSelectCategory}
                />
              )}
            </section>
          </Card>

          <Card>
            <section aria-labelledby="summary-history-heading">
              <h2 id="summary-history-heading" className="mb-2 text-section font-semibold text-text">
                6 รอบล่าสุด
              </h2>
              <SpendingHistoryChart
                history={history}
                selectedPeriodKey={selectedPeriodKey}
                colorMap={colorMap}
                onSelectPeriod={onSelectPeriod}
              />
            </section>
          </Card>
        </div>
      )}
    </div>
  );
}
