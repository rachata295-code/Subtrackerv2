import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { financeFixture } from '../fixtures/finance';
import * as domain from '../domain';
import type { FinanceData, Forecast } from '../types/finance';
import { AvailableCard } from './AvailableCard';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const BASE_FORECAST: Forecast = {
  start: 468_000,
  incoming: 510_000,
  bills: 0,
  plans: 350_000,
  potsLeft: 778_007,
  available: -150_007,
  timeline: [],
  low: null,
};

function renderCard(data: FinanceData, today: string) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AvailableCard data={data} today={today} />
    </MemoryRouter>,
  );
}

describe('<AvailableCard>', () => {
  it('renders nothing when forecast throws not implemented', () => {
    vi.spyOn(domain, 'forecast').mockImplementation(() => {
      throw new Error('not implemented: forecast');
    });
    const { container } = renderCard(financeFixture, '2026-11-15');
    expect(container.firstChild).toBeNull();
  });

  it('shows available amount and days since last balance check without warning badge within 7 days', () => {
    vi.spyOn(domain, 'forecast').mockReturnValue({ ...BASE_FORECAST, available: 125_000 });
    renderCard(financeFixture, '2026-11-15');

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/plan');
    expect(screen.getByText('ใช้ได้จริง')).toBeTruthy();
    expect(link.textContent).toContain('฿1,250.00');
    expect(screen.getByText(/เช็กยอด 5 วันก่อน/)).toBeTruthy();
    expect(screen.queryByText('ถึงเวลาเช็กยอดแล้ว')).toBeNull();
  });

  it('shows "ถึงเวลาเช็กยอดแล้ว" badge when last check was more than 7 days ago or never checked', () => {
    vi.spyOn(domain, 'forecast').mockReturnValue({ ...BASE_FORECAST, available: 320_000 });
    const { rerender } = renderCard(financeFixture, '2026-11-18'); // 8 days after 2026-11-10

    expect(screen.getByText(/เช็กยอด 8 วันก่อน/)).toBeTruthy();
    expect(screen.getByText('ถึงเวลาเช็กยอดแล้ว')).toBeTruthy();

    const noCheckData: FinanceData = { ...financeFixture, balanceChecks: [] };
    rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AvailableCard data={noCheckData} today="2026-11-15" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/ยังไม่เคยเช็กยอด/)).toBeTruthy();
    expect(screen.getByText('ถึงเวลาเช็กยอดแล้ว')).toBeTruthy();
  });

  it('picks the bank source receiving the highest active recurring income when multiple banks exist', () => {
    const forecastSpy = vi.spyOn(domain, 'forecast').mockReturnValue({ ...BASE_FORECAST, available: 90_000 });
    const multiBank: FinanceData = {
      ...financeFixture,
      sources: [
        ...financeFixture.sources,
        {
          id: 'src-bank-2',
          name: 'กสิกร',
          kind: 'bank',
          hue: 'teal',
          archived: false,
          statementCloseDay: null,
          dueDay: null,
          dueMonthOffset: null,
          payFromSourceId: null,
        },
      ],
      recurringIncomes: [
        { id: 'inc-a', name: 'เสริม', amount: 100_000, dayOfMonth: 5, sourceId: 'src-bank', active: true },
        { id: 'inc-b', name: 'เงินเดือน', amount: 900_000, dayOfMonth: 10, sourceId: 'src-bank-2', active: true },
      ],
    };

    renderCard(multiBank, '2026-11-15');
    expect(forecastSpy).toHaveBeenCalledWith(multiBank, 'src-bank-2', '2026-11-15');
    expect(screen.getByText(/กสิกร/)).toBeTruthy();
  });
});
