import { useId, type KeyboardEvent } from 'react';
import { parsePeriodKey } from '../../domain/date';
import { formatTHB } from '../../lib/money';
import { thaiMonthShort } from '../../lib/thaiDate';
import type { PeriodKey, PeriodSpending } from '../../types/finance';
import { HUE_MARK, type Hue } from '../ui/hue';
import { buildStackedHistory } from './categoryColors';

export interface SpendingHistoryChartProps {
  history: PeriodSpending[];
  selectedPeriodKey: PeriodKey;
  colorMap: Map<import('../../types/finance').SummaryCategory, Hue>;
  onSelectPeriod: (periodKey: PeriodKey) => void;
}

function formatPeriodMonthShort(key: PeriodKey): string {
  const { month } = parsePeriodKey(key);
  return thaiMonthShort(month - 1);
}

function formatPeriodMonthYear(key: PeriodKey): string {
  const { year, month } = parsePeriodKey(key);
  return `${thaiMonthShort(month - 1)} ${year + 543}`;
}

function computeNiceMaxBaht(maxBaht: number): number {
  if (maxBaht <= 0) return 1000;
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxBaht)));
  const normalized = maxBaht / magnitude;
  let step: number;
  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  else step = 10;
  return step * magnitude;
}

function formatAxisBaht(baht: number): string {
  if (baht === 0) return '฿0';
  if (baht >= 1000 && baht % 1000 === 0) return `฿${baht / 1000}k`;
  return `฿${Math.round(baht).toLocaleString('en-US')}`;
}

function segmentFillCss(hue: Hue, useMutedFill: boolean): string {
  return useMutedFill ? 'rgb(var(--muted))' : `rgb(var(--${hue}-mark))`;
}

/**
 * Custom zero-dependency SVG stacked bar chart for the last 6 pay periods (SPEC §3).
 * Uses CSS custom property tokens directly so light and dark themes stay contrast-compliant.
 */
export function SpendingHistoryChart({
  history,
  selectedPeriodKey,
  colorMap,
  onSelectPeriod,
}: SpendingHistoryChartProps) {
  const baseId = useId();
  const { series, bars } = buildStackedHistory(history, colorMap);

  const maxTotalBaht = Math.max(0, ...bars.map((b) => b.total / 100));
  const axisMaxBaht = computeNiceMaxBaht(maxTotalBaht);
  const ticks = [0, axisMaxBaht / 2, axisMaxBaht];

  const svgWidth = 360;
  const svgHeight = 208;
  const plotLeft = 48;
  const plotRight = 352;
  const plotTop = 16;
  const plotBottom = 166;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;
  const colCount = Math.max(1, bars.length);
  const colWidth = plotWidth / colCount;
  const barWidth = Math.min(28, colWidth * 0.56);

  const handleBarKeyDown = (e: KeyboardEvent<SVGGElement>, key: PeriodKey) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectPeriod(key);
    }
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="h-auto w-full select-none"
        role="img"
        aria-label="กราฟแท่งซ้อนยอดใช้จ่าย 6 รอบล่าสุด"
      >
        <defs>
          {bars.map((bar, idx) => {
            const totalBaht = bar.total / 100;
            const totalHeight = axisMaxBaht > 0 ? (totalBaht / axisMaxBaht) * plotHeight : 0;
            const barHeight = totalBaht > 0 ? Math.max(4, totalHeight) : 0;
            const colX = plotLeft + idx * colWidth;
            const barX = colX + (colWidth - barWidth) / 2;
            const barTopY = plotBottom - barHeight;
            return (
              <clipPath key={bar.periodKey} id={`${baseId}-clip-${idx}`}>
                <rect x={barX} y={barTopY} width={barWidth} height={barHeight} rx={4} />
              </clipPath>
            );
          })}
        </defs>

        {/* Horizontal gridlines and Y-axis ticks */}
        {ticks.map((tick) => {
          const y = plotBottom - (tick / axisMaxBaht) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={plotLeft}
                y1={y}
                x2={plotRight}
                y2={y}
                stroke={tick === 0 ? 'rgb(var(--border))' : 'rgb(var(--rule))'}
                strokeWidth={1}
              />
              <text
                x={plotLeft - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={12}
                fill="rgb(var(--muted))"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatAxisBaht(tick)}
              </text>
            </g>
          );
        })}

        {/* Period bar columns */}
        {bars.map((bar, idx) => {
          const isSelected = bar.periodKey === selectedPeriodKey;
          const colX = plotLeft + idx * colWidth;
          const barX = colX + (colWidth - barWidth) / 2;
          const centerX = colX + colWidth / 2;
          const totalBaht = bar.total / 100;
          const rawTotalHeight = axisMaxBaht > 0 ? (totalBaht / axisMaxBaht) * plotHeight : 0;
          const barHeight = totalBaht > 0 ? Math.max(4, rawTotalHeight) : 0;

          let cursorY = plotBottom;
          const segmentRects = bar.segments.map((seg, segIdx) => {
            const isTop = segIdx === bar.segments.length - 1;
            const segH = isTop
              ? Math.max(0, cursorY - (plotBottom - barHeight))
              : bar.total > 0
                ? (seg.amount / bar.total) * barHeight
                : 0;
            const y = cursorY - segH;
            cursorY = y;
            return { ...seg, y, height: segH };
          });

          const periodLabel = formatPeriodMonthYear(bar.periodKey);

          return (
            <g
              key={bar.periodKey}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`รอบ ${periodLabel} รวม ${formatTHB(totalBaht)}`}
              onClick={() => onSelectPeriod(bar.periodKey)}
              onKeyDown={(e) => handleBarKeyDown(e, bar.periodKey)}
              className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {/* Full-column backdrop & hit target so small/zero bars remain easy to tap (>=44px tall). */}
              <rect
                x={colX + 3}
                y={plotTop - 4}
                width={Math.max(1, colWidth - 6)}
                height={plotBottom - plotTop + 34}
                rx={10}
                fill={isSelected ? 'rgb(var(--raised))' : 'transparent'}
              />

              <g clipPath={`url(#${baseId}-clip-${idx})`}>
                {segmentRects.map((seg) => (
                  <rect
                    key={seg.category}
                    x={barX}
                    y={seg.y}
                    width={barWidth}
                    height={seg.height}
                    fill={segmentFillCss(seg.hue, seg.useMutedFill)}
                  />
                ))}
                {/* Hairline separators only between adjacent segments so tiny slices keep full fill area. */}
                {segmentRects.slice(0, -1).map((seg) => (
                  <line
                    key={`sep-${seg.category}`}
                    x1={barX}
                    y1={seg.y}
                    x2={barX + barWidth}
                    y2={seg.y}
                    stroke="rgb(var(--surface))"
                    strokeWidth={1}
                  />
                ))}
              </g>

              {isSelected ? (
                <rect
                  x={barX}
                  y={plotBottom + 4}
                  width={barWidth}
                  height={3}
                  rx={1.5}
                  fill="rgb(var(--accent))"
                />
              ) : null}

              <text
                x={centerX}
                y={plotBottom + 22}
                textAnchor="middle"
                fontSize={12}
                fontWeight={isSelected ? 600 : 400}
                fill={isSelected ? 'rgb(var(--text))' : 'rgb(var(--muted))'}
              >
                {formatPeriodMonthShort(bar.periodKey)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      {series.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="คำอธิบายสีหมวดหมู่">
          {[...series].reverse().map((s) => (
            <li key={s.category} className="flex items-center gap-1.5 text-xs text-muted">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-dot ${s.useMutedFill ? 'bg-muted' : HUE_MARK[s.hue]}`}
              />
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Screen-reader data table */}
      <table className="sr-only">
        <caption>ยอดใช้จ่าย 6 รอบล่าสุดแยกตามหมวด</caption>
        <thead>
          <tr>
            <th scope="col">รอบ</th>
            <th scope="col">ยอดใช้รวม</th>
            {series.map((s) => (
              <th key={s.category} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => {
            const byCat = new Map(bar.segments.map((seg) => [seg.category, seg.amount]));
            return (
              <tr key={bar.periodKey}>
                <th scope="row">{formatPeriodMonthYear(bar.periodKey)}</th>
                <td>{formatTHB(bar.total / 100)}</td>
                {series.map((s) => (
                  <td key={s.category}>{formatTHB((byCat.get(s.category) ?? 0) / 100)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
