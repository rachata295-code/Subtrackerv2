import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { financeFixture } from '../../fixtures/finance';
import { AppToaster } from '../../components/ui/Toaster';
import { mockMatchMedia } from '../../test/mockMatchMedia';
import type { FinanceData, PeriodKey, PeriodSpending } from '../../types/finance';

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}

vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

let mockData: FinanceData;

vi.mock('../../hooks/useFinance', () => ({
  useFinanceData: () => ({ data: mockData, isLoading: false, error: null }),
  useCreateTransaction: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null }),
  useUpdateTransaction: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null }),
  useDeleteTransaction: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, error: null }),
}));

const spendingByCategoryMock = vi.fn<(data: FinanceData, periodKey: PeriodKey) => PeriodSpending>();
const spendingHistoryMock = vi.fn<(data: FinanceData, periodKey: PeriodKey, n?: number) => PeriodSpending[]>();

vi.mock('../../domain', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain')>();
  return {
    ...actual,
    spendingByCategory: (data: FinanceData, periodKey: PeriodKey) => spendingByCategoryMock(data, periodKey),
    spendingHistory: (data: FinanceData, periodKey: PeriodKey, n?: number) =>
      spendingHistoryMock(data, periodKey, n),
  };
});

import EntriesPage from './index';

function LocationProbe({
  onChange,
}: {
  onChange: (loc: { pathname: string; search: string }, navigate: ReturnType<typeof useNavigate>) => void;
}) {
  const loc = useLocation();
  const navigate = useNavigate();
  onChange({ pathname: loc.pathname, search: loc.search }, navigate);
  return null;
}

function Harness({
  initialData = financeFixture,
  initialEntries = ['/entries'],
  today = '2026-11-15',
  onLocation,
}: {
  initialData?: FinanceData;
  initialEntries?: string[];
  today?: string;
  onLocation?: (loc: { pathname: string; search: string }, navigate: ReturnType<typeof useNavigate>) => void;
}) {
  const [data] = useState(initialData);
  mockData = data;
  return (
    <MemoryRouter
      initialEntries={initialEntries}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      {onLocation ? <LocationProbe onChange={onLocation} /> : null}
      <EntriesPage today={today} />
      <AppToaster />
    </MemoryRouter>
  );
}

// Fixtures-aligned spending summaries (Nov 2026: AirPods 138,193 + Subs 107,700 + Movie/Game 33,500 + Tea 8,500 = 287,893)
const PERIOD_MAP: Record<PeriodKey, PeriodSpending> = {
  '2026-06': {
    periodKey: '2026-06',
    total: 150_000,
    saved: 0,
    unknown: 0,
    categories: [{ category: 'food', amount: 150_000, percent: 100 }],
  },
  '2026-07': {
    periodKey: '2026-07',
    total: 180_000,
    saved: 0,
    unknown: 0,
    categories: [{ category: 'food', amount: 180_000, percent: 100 }],
  },
  '2026-08': {
    periodKey: '2026-08',
    total: 200_000,
    saved: 0,
    unknown: 0,
    categories: [{ category: 'subscription', amount: 200_000, percent: 100 }],
  },
  '2026-09': {
    periodKey: '2026-09',
    total: 220_000,
    saved: 0,
    unknown: 0,
    categories: [
      { category: 'installment', amount: 138_193, percent: 62.8 },
      { category: 'food', amount: 81_807, percent: 37.2 },
    ],
  },
  '2026-10': {
    periodKey: '2026-10',
    total: 276_393,
    saved: 100_000,
    unknown: 0,
    categories: [
      { category: 'installment', amount: 138_193, percent: 50.0 },
      { category: 'subscription', amount: 107_700, percent: 39.0 },
      { category: 'food', amount: 30_500, percent: 11.0 },
      { category: 'other', amount: 7, percent: 0.0 },
    ],
  },
  '2026-11': {
    periodKey: '2026-11',
    total: 292_893,
    saved: 200_000,
    unknown: 5_000,
    categories: [
      { category: 'installment', amount: 138_193, percent: 47.2 },
      { category: 'subscription', amount: 107_700, percent: 36.8 },
      { category: 'entertainment', amount: 33_500, percent: 11.4 },
      { category: 'food', amount: 8_500, percent: 2.9 },
      { category: 'unknown', amount: 5_000, percent: 1.7 },
    ],
  },
};

beforeEach(() => {
  spendingByCategoryMock.mockReset().mockImplementation((_data, key) => {
    return (
      PERIOD_MAP[key] ?? {
        periodKey: key,
        total: 0,
        saved: 0,
        unknown: 0,
        categories: [],
      }
    );
  });
  spendingHistoryMock.mockReset().mockImplementation(() => [
    PERIOD_MAP['2026-06'],
    PERIOD_MAP['2026-07'],
    PERIOD_MAP['2026-08'],
    PERIOD_MAP['2026-09'],
    PERIOD_MAP['2026-10'],
    PERIOD_MAP['2026-11'],
  ]);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('/entries summary tab', () => {
  it('switches between รายการ and สรุป via top SegmentedControl and syncs ?view=summary in URL', () => {
    let latestLoc = { pathname: '/entries', search: '' };
    render(<Harness onLocation={(loc) => (latestLoc = loc)} />);

    const viewControl = screen.getByRole('tablist', { name: 'มุมมอง' });
    expect(within(viewControl).getAllByRole('tab').map((t) => t.textContent)).toEqual(['รายการ', 'สรุป']);

    // Default is list view
    expect(screen.getByText('หนัง')).toBeTruthy();
    expect(latestLoc.search).toBe('');

    // Switch to สรุป -> URL updates to ?view=summary
    fireEvent.click(within(viewControl).getByRole('tab', { name: 'สรุป' }));
    expect(latestLoc.search).toContain('view=summary');
    expect(screen.getByTestId('summary-total').textContent).toBe('฿2,928.93');
    // Comparison with 2026-10: 292,893 - 276,393 = +16,500 (+฿165.00)
    expect(screen.getByText(/\+฿165\.00 จากรอบก่อน/)).toBeTruthy();
    // Saved & Unknown lines
    expect(screen.getByText('เก็บรอบนี้')).toBeTruthy();
    expect(screen.getByTestId('summary-saved').textContent).toBe('฿2,000.00');
    expect(screen.getByTestId('summary-unknown').textContent).toBe('฿50.00');
  });

  it('opens summary directly when initial URL has ?view=summary', () => {
    render(<Harness initialEntries={['/entries?view=summary']} />);
    expect(screen.getByTestId('summary-total').textContent).toBe('฿2,928.93');
    expect(screen.getByText('แยกตามหมวด')).toBeTruthy();
    expect(screen.getByText('6 รอบล่าสุด')).toBeTruthy();
  });

  it('clicks a category horizontal bar to switch to รายการ tab filtered by that category', async () => {
    let latestLoc = { pathname: '/entries', search: '' };
    render(<Harness initialEntries={['/entries?view=summary']} onLocation={(loc) => (latestLoc = loc)} />);

    const breakdownSection = screen.getByRole('region', { name: 'แยกตามหมวด' });
    const entertainmentBtn = within(breakdownSection).getByRole('button', { name: /บันเทิง/ });
    fireEvent.click(entertainmentBtn);

    await waitFor(() => {
      expect(latestLoc.search).not.toContain('view=summary');
    });
    expect(latestLoc.search).toContain('category=entertainment');

    // Only entertainment items (หนัง, เกม) are visible; ชานม (food) is filtered out
    expect(screen.getByText('หนัง')).toBeTruthy();
    expect(screen.getByText('เกม')).toBeTruthy();
    expect(screen.queryByText('ชานม')).toBeNull();

    // Clear category filter restores ชานม
    fireEvent.click(screen.getByRole('button', { name: /ล้างตัวกรองหมวด/ }));
    expect(screen.getByText('ชานม')).toBeTruthy();
  });

  it('clicks a stacked bar in the 6-period SVG chart to change the selected period', async () => {
    render(<Harness initialEntries={['/entries?view=summary']} />);

    expect(screen.getByTestId('summary-total').textContent).toBe('฿2,928.93');

    const historySection = screen.getByRole('region', { name: '6 รอบล่าสุด' });
    const octBar = within(historySection).getByRole('button', { name: /ต\.ค\. 2569/ });
    fireEvent.click(octBar);

    await waitFor(() => {
      expect(screen.getByTestId('summary-total').textContent).toBe('฿2,763.93');
    });
    await waitFor(() => {
      expect(screen.getByTestId('summary-saved').textContent).toBe('฿1,000.00');
    });
    expect(screen.queryByTestId('summary-unknown')).toBeNull();
  });

  it('supports browser Back navigation between list, ?view=summary, and ?category=...', async () => {
    let latestLoc = { pathname: '/entries', search: '' };
    let navFn: ReturnType<typeof useNavigate> | null = null;
    render(
      <Harness
        onLocation={(loc, navigate) => {
          latestLoc = loc;
          navFn = navigate;
        }}
      />,
    );

    const viewControl = screen.getByRole('tablist', { name: 'มุมมอง' });
    fireEvent.click(within(viewControl).getByRole('tab', { name: 'สรุป' }));
    expect(latestLoc.search).toBe('?view=summary');

    const breakdownSection = screen.getByRole('region', { name: 'แยกตามหมวด' });
    fireEvent.click(within(breakdownSection).getByRole('button', { name: /บันเทิง/ }));
    expect(latestLoc.search).toBe('?category=entertainment');
    expect(screen.getByText('หนัง')).toBeTruthy();

    // Back from filtered list -> returns to ?view=summary
    act(() => {
      navFn?.(-1);
    });
    await waitFor(() => expect(latestLoc.search).toBe('?view=summary'));
    expect(screen.getByText('แยกตามหมวด')).toBeTruthy();

    // Back from ?view=summary -> returns to default list
    act(() => {
      navFn?.(-1);
    });
    await waitFor(() => expect(latestLoc.search).toBe(''));
    expect(screen.getByText('ชานม')).toBeTruthy();
  });

  it('shows per-period empty state when selected period has 0 spending while history has data', async () => {
    spendingByCategoryMock.mockImplementation((_d, key) =>
      key === '2026-06'
        ? { periodKey: '2026-06', total: 0, saved: 0, unknown: 0, categories: [] }
        : (PERIOD_MAP[key] ?? { periodKey: key, total: 0, saved: 0, unknown: 0, categories: [] }),
    );
    spendingHistoryMock.mockImplementation(() => [
      { periodKey: '2026-06', total: 0, saved: 0, unknown: 0, categories: [] },
      PERIOD_MAP['2026-07'],
      PERIOD_MAP['2026-08'],
      PERIOD_MAP['2026-09'],
      PERIOD_MAP['2026-10'],
      PERIOD_MAP['2026-11'],
    ]);

    render(<Harness initialEntries={['/entries?view=summary']} />);
    const historySection = screen.getByRole('region', { name: '6 รอบล่าสุด' });
    fireEvent.click(within(historySection).getByRole('button', { name: /มิ\.ย\. 2569/ }));

    await waitFor(() => {
      expect(screen.getByText('ยังไม่มีการใช้จ่ายในรอบนี้')).toBeTruthy();
    });
    expect(screen.getByRole('region', { name: '6 รอบล่าสุด' })).toBeTruthy();
  });

  it('renders empty state when all 6 periods have no spending', () => {
    spendingByCategoryMock.mockImplementation((_d, key) => ({
      periodKey: key,
      total: 0,
      saved: 0,
      unknown: 0,
      categories: [],
    }));
    spendingHistoryMock.mockImplementation(() => [
      { periodKey: '2026-06', total: 0, saved: 0, unknown: 0, categories: [] },
      { periodKey: '2026-07', total: 0, saved: 0, unknown: 0, categories: [] },
      { periodKey: '2026-08', total: 0, saved: 0, unknown: 0, categories: [] },
      { periodKey: '2026-09', total: 0, saved: 0, unknown: 0, categories: [] },
      { periodKey: '2026-10', total: 0, saved: 0, unknown: 0, categories: [] },
      { periodKey: '2026-11', total: 0, saved: 0, unknown: 0, categories: [] },
    ]);

    render(<Harness initialEntries={['/entries?view=summary']} />);
    expect(screen.getByText('ยังไม่มีข้อมูลการใช้จ่าย')).toBeTruthy();
  });

  it('shows error card gracefully without crashing if domain throws', () => {
    spendingByCategoryMock.mockImplementation(() => {
      throw new Error('not implemented: spendingByCategory');
    });

    render(<Harness initialEntries={['/entries?view=summary']} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/ไม่สามารถคำนวณสรุปการใช้จ่ายได้/)).toBeTruthy();
  });

  it('renders mobile stacked layout at 375px and 2-column grid (left bars, right 6-period chart) at 1280px', () => {
    const mm = mockMatchMedia(375);
    const { container } = render(<Harness initialEntries={['/entries?view=summary']} />);

    const summaryGrid = container.querySelector('[data-testid="summary-charts-grid"]');
    expect(summaryGrid).not.toBeNull();
    expect(summaryGrid?.className).toContain('grid-cols-1');
    expect(summaryGrid?.className).toContain('lg:grid-cols-2');

    act(() => {
      mm.setWidth(1280);
    });
    expect(screen.getByRole('region', { name: 'แยกตามหมวด' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '6 รอบล่าสุด' })).toBeTruthy();
  });
});
