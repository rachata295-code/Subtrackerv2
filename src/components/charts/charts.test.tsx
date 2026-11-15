import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  buildCategoryColorMap,
  buildStackedHistory,
  CategorySpendChart,
  SpendingHistoryChart,
} from './index';
import type { CategorySpend, PeriodSpending, SummaryCategory } from '../../types/finance';

afterEach(() => {
  cleanup();
});

const SAMPLE_CATEGORIES: CategorySpend[] = [
  { category: 'installment', amount: 138_193, percent: 47.9 },
  { category: 'subscription', amount: 107_700, percent: 37.3 },
  { category: 'entertainment', amount: 33_500, percent: 11.6 },
  { category: 'food', amount: 8_500, percent: 2.9 },
  { category: 'unknown', amount: 700, percent: 0.2 },
];

const SAMPLE_HISTORY: PeriodSpending[] = [
  {
    periodKey: '2026-06',
    total: 200_000,
    saved: 0,
    unknown: 0,
    categories: [
      { category: 'installment', amount: 138_193, percent: 69.1 },
      { category: 'food', amount: 61_807, percent: 30.9 },
    ],
  },
  {
    periodKey: '2026-07',
    total: 250_000,
    saved: 0,
    unknown: 0,
    categories: [
      { category: 'installment', amount: 138_193, percent: 55.3 },
      { category: 'subscription', amount: 107_700, percent: 43.1 },
      { category: 'food', amount: 4_107, percent: 1.6 },
    ],
  },
  {
    periodKey: '2026-08',
    total: 260_000,
    saved: 0,
    unknown: 0,
    categories: [
      { category: 'installment', amount: 138_193, percent: 53.2 },
      { category: 'subscription', amount: 107_700, percent: 41.4 },
      { category: 'entertainment', amount: 14_107, percent: 5.4 },
    ],
  },
  {
    periodKey: '2026-09',
    total: 270_000,
    saved: 0,
    unknown: 0,
    categories: [
      { category: 'installment', amount: 138_193, percent: 51.2 },
      { category: 'subscription', amount: 107_700, percent: 39.9 },
      { category: 'food', amount: 24_107, percent: 8.9 },
    ],
  },
  {
    periodKey: '2026-10',
    total: 276_000,
    saved: 0,
    unknown: 0,
    categories: [
      { category: 'installment', amount: 138_193, percent: 50.1 },
      { category: 'subscription', amount: 107_700, percent: 39.0 },
      { category: 'food', amount: 30_107, percent: 10.9 },
    ],
  },
  {
    periodKey: '2026-11',
    total: 288_593,
    saved: 200_000,
    unknown: 700,
    categories: SAMPLE_CATEGORIES,
  },
];

describe('categoryColors & >6 folding', () => {
  it('assigns stone to unknown/other and distinct hues to top categories', () => {
    const colorMap = buildCategoryColorMap(SAMPLE_HISTORY);
    expect(colorMap.get('unknown')).toBe('stone');
    expect(colorMap.get('installment')).toBeDefined();
    expect(colorMap.get('subscription')).toBeDefined();
    expect(colorMap.get('installment')).not.toBe(colorMap.get('subscription'));
  });

  it('folds categories beyond 6 into "อื่นๆ" (other) in the stacked history', () => {
    const manyCategories: CategorySpend[] = [
      { category: 'food', amount: 70_000, percent: 25 },
      { category: 'transport', amount: 60_000, percent: 21.4 },
      { category: 'shopping', amount: 50_000, percent: 17.9 },
      { category: 'entertainment', amount: 40_000, percent: 14.3 },
      { category: 'health', amount: 30_000, percent: 10.7 },
      { category: 'bills', amount: 20_000, percent: 7.1 },
      { category: 'subscription', amount: 10_000, percent: 3.6 },
    ];
    const history: PeriodSpending[] = [
      { periodKey: '2026-11', total: 280_000, saved: 0, unknown: 0, categories: manyCategories },
    ];

    const colorMap = buildCategoryColorMap(history);
    const stacked = buildStackedHistory(history, colorMap);

    // Overflow categories (>5 chromatic + stone "อื่นๆ" = max 6 series) are folded into 'other'.
    expect(stacked.series.length).toBeLessThanOrEqual(6);
    expect(stacked.series.some((s) => s.category === 'other')).toBe(true);
    const otherValue = stacked.bars[0].segments.find((seg) => seg.category === 'other')?.amount ?? 0;
    expect(otherValue).toBeGreaterThanOrEqual(10_000);
    // Total of stacked segments equals the period total.
    const sum = stacked.bars[0].segments.reduce((acc, seg) => acc + seg.amount, 0);
    expect(sum).toBe(280_000);
  });
});

describe('<CategorySpendChart>', () => {
  it('renders categories sorted descending with baht + % and triggers onSelectCategory on click', () => {
    const colorMap = buildCategoryColorMap(SAMPLE_HISTORY);
    const onSelect = vi.fn<(cat: SummaryCategory) => void>();

    render(
      <CategorySpendChart
        categories={[...SAMPLE_CATEGORIES].reverse()}
        colorMap={colorMap}
        onSelectCategory={onSelect}
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(5);
    // Sorted descending: ผ่อนชำระ first, ลืมจด last
    expect(buttons[0].textContent).toContain('ผ่อนชำระ');
    expect(buttons[0].textContent).toContain('฿1,381.93');
    expect(buttons[0].textContent).toContain('47.9%');
    expect(buttons[4].textContent).toContain('ลืมจด');

    fireEvent.click(buttons[2]);
    expect(onSelect).toHaveBeenCalledWith('entertainment');

    // Screen reader accessible hidden table exists
    const table = document.querySelector('table.sr-only');
    expect(table).not.toBeNull();
    expect(within(table as HTMLElement).getByText('ผ่อนชำระ')).toBeTruthy();
  });
});

describe('<SpendingHistoryChart>', () => {
  it('renders custom SVG stacked bars for 6 periods, selects period on click, and includes sr-only table', () => {
    const colorMap = buildCategoryColorMap(SAMPLE_HISTORY);
    const onSelectPeriod = vi.fn<(key: string) => void>();

    const { container } = render(
      <SpendingHistoryChart
        history={SAMPLE_HISTORY}
        selectedPeriodKey="2026-11"
        colorMap={colorMap}
        onSelectPeriod={onSelectPeriod}
      />,
    );

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const barButtons = screen.getAllByRole('button');
    expect(barButtons.length).toBe(6);
    expect(barButtons[5].getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(barButtons[1]);
    expect(onSelectPeriod).toHaveBeenCalledWith('2026-07');

    // Keyboard activation
    fireEvent.keyDown(barButtons[0], { key: 'Enter' });
    expect(onSelectPeriod).toHaveBeenCalledWith('2026-06');

    const table = container.querySelector('table.sr-only');
    expect(table).not.toBeNull();
    expect(within(table as HTMLElement).getByText('พ.ย. 2569')).toBeTruthy();
  });
});
