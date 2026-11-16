import { AnimatedMoney } from '../ui/AnimatedMoney';
import { HUE_MARK, type Hue } from '../ui/hue';
import { formatTHB } from '../../lib/money';
import { SUMMARY_CATEGORY_LABELS, type CategorySpend, type SummaryCategory } from '../../types/finance';

export interface CategorySpendChartProps {
  categories: CategorySpend[];
  colorMap: Map<SummaryCategory, Hue>;
  onSelectCategory: (category: SummaryCategory) => void;
}

function formatPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

/**
 * Horizontal category breakdown bars. Bars scale with transform:scaleX so updates animate
 * without layout reflow and clicking any row filters the Entries list to that category.
 */
export function CategorySpendChart({
  categories,
  colorMap,
  onSelectCategory,
}: CategorySpendChartProps) {
  const sorted = [...categories]
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));

  const maxAmount = sorted[0]?.amount ?? 0;

  return (
    <div>
      <ul className="space-y-1.5">
        {sorted.map((item) => {
          const label = SUMMARY_CATEGORY_LABELS[item.category];
          const hue = item.category === 'unknown' ? 'stone' : (colorMap.get(item.category) ?? 'stone');
          const ratio = maxAmount > 0 ? Math.max(0.02, item.amount / maxAmount) : 0;
          const pctText = formatPercent(item.percent);
          const baht = item.amount / 100;

          return (
            <li key={item.category}>
              <button
                type="button"
                onClick={() => onSelectCategory(item.category)}
                aria-label={`${label} ${formatTHB(baht)} (${pctText}) — ดูรายการในหมวดนี้`}
                className="pressable min-h-tap w-full rounded-tile px-2 py-2 text-left transition-transform duration-press ease-out hover-fine:hover:bg-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-text">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 shrink-0 rounded-dot ${HUE_MARK[hue]}`}
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <AnimatedMoney value={baht} size="sm" live={false} />
                    <span className="w-11 text-right text-xs tabular-nums text-muted">{pctText}</span>
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-pill bg-stone-bg"
                >
                  <span
                    className={`block h-full w-full origin-left rounded-pill transition-transform duration-base ease-in-out motion-reduce:transition-none ${HUE_MARK[hue]}`}
                    style={{ transform: `scaleX(${ratio})` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <table className="sr-only">
        <caption>สรุปยอดใช้จ่ายแยกตามหมวด</caption>
        <thead>
          <tr>
            <th scope="col">หมวดหมู่</th>
            <th scope="col">ยอดใช้จ่าย</th>
            <th scope="col">สัดส่วน</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.category}>
              <th scope="row">{SUMMARY_CATEGORY_LABELS[item.category]}</th>
              <td>{formatTHB(item.amount / 100)}</td>
              <td>{formatPercent(item.percent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
