import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { financeFixture } from '../../fixtures/finance';
import { ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { AppToaster } from '../../components/ui/Toaster';
import { HOLD_MS } from '../../components/ui/HoldToDelete';
import { mockMatchMedia } from '../../test/mockMatchMedia';
import type { CreateTransactionInput, FinanceData, Transaction } from '../../types/finance';

// Vaul calls setPointerCapture/releasePointerCapture on pointerDown inside BottomSheet; jsdom omits them.
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}

// Mock ThemeProvider so AppToaster doesn't touch localStorage in jsdom.
vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

let mockData: FinanceData;
const createSpy = vi.fn<(input: CreateTransactionInput) => Promise<Transaction>>();
const updateSpy = vi.fn<(input: Transaction) => Promise<Transaction>>();
const deleteSpy = vi.fn<(id: string) => Promise<void>>();

let setStateHook: ((next: FinanceData) => void) | null = null;

vi.mock('../../hooks/useFinance', () => ({
  useFinanceData: () => ({ data: mockData, isLoading: false, error: null }),
  useCreateTransaction: () => ({
    mutate: (input: CreateTransactionInput) => {
      void createSpy(input);
    },
    mutateAsync: createSpy,
    isPending: false,
    error: null,
  }),
  useUpdateTransaction: () => ({
    mutate: (input: Transaction) => {
      void updateSpy(input);
    },
    mutateAsync: updateSpy,
    isPending: false,
    error: null,
  }),
  useDeleteTransaction: () => ({
    mutate: (id: string) => {
      void deleteSpy(id);
    },
    mutateAsync: deleteSpy,
    isPending: false,
    error: null,
  }),
}));

import EntriesPage from './index';
import { payPeriod } from '../../domain';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

function StatefulHarness({ initial, today = '2026-11-15' }: { initial: FinanceData; today?: string }) {
  const [state, setState] = useState<FinanceData>(initial);
  mockData = state;
  setStateHook = setState;
  return (
    <MemoryRouter initialEntries={['/entries']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <EntriesPage today={today} />
      <AppToaster />
    </MemoryRouter>
  );
}

function makeFixtureClone(extraTx: Transaction[] = []): FinanceData {
  return {
    ...financeFixture,
    sources: financeFixture.sources.map((s) => ({ ...s })),
    pots: financeFixture.pots.map((p) => ({ ...p })),
    transactions: [...financeFixture.transactions.map((t) => ({ ...t })), ...extraTx],
  };
}

let nextId = 1;

beforeEach(() => {
  nextId = 1;
  toast.dismiss();
  createSpy.mockReset().mockImplementation(async (input) => {
    const created: Transaction = {
      id: `tx-new-${nextId++}`,
      ...input,
      createdAt: input.createdAt ?? `${input.date}T12:00:00.000Z`,
      recurringIncomeId: input.recurringIncomeId ?? null,
      incomeDueOn: input.incomeDueOn ?? null,
    };
    setStateHook?.({
      ...mockData,
      transactions: [...mockData.transactions, created],
    });
    return created;
  });
  updateSpy.mockReset().mockImplementation(async (input) => {
    setStateHook?.({
      ...mockData,
      transactions: mockData.transactions.map((t) => (t.id === input.id ? input : t)),
    });
    return input;
  });
  deleteSpy.mockReset().mockImplementation(async (id) => {
    setStateHook?.({
      ...mockData,
      transactions: mockData.transactions.filter((t) => t.id !== id),
    });
  });
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setStateHook = null;
});

describe('<EntriesPage>', () => {
  it('renders header, add button, pay period options, and source filter options', () => {
    render(<StatefulHarness initial={makeFixtureClone()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'รายการ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'เพิ่มรายการ' })).toBeTruthy();

    const periodList = screen.getByRole('tablist', { name: 'รอบเงินเดือน' });
    expect(within(periodList).getAllByRole('tab').map((t) => t.textContent)).toEqual(['รอบนี้', 'รอบก่อน', '2 รอบก่อน']);

    const sourceList = screen.getByRole('tablist', { name: 'กรองช่องทาง' });
    expect(within(sourceList).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'ทั้งหมด',
      'บัญชี',
      'บัตรเครดิต',
      'SPayLater',
    ]);
  });

  it('groups transactions by Thai date and computes right-aligned daily totals accurately', () => {
    const extra: Transaction[] = [
      {
        id: 'tx-nov-coffee',
        date: '2026-11-12',
        amount: 6_500, // ฿65.00 + ฿85.00 (ชานม) = ฿150.00
        direction: 'out',
        sourceId: 'src-card',
        potId: 'pot-play',
        category: 'food',
        note: 'กาแฟ',
        createdAt: '2026-11-12T10:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
      {
        id: 'tx-nov-refund',
        date: '2026-11-13',
        amount: 50_000, // +฿500.00 income
        direction: 'in',
        sourceId: 'src-bank',
        potId: null,
        category: 'other',
        note: 'โอนคืน',
        createdAt: '2026-11-13T10:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
    ];
    render(<StatefulHarness initial={makeFixtureClone(extra)} />);

    // 14 Nov: ฿115.00
    const day14 = screen.getByTestId('day-group-2026-11-14');
    expect(within(day14).getByText('14 พ.ย. 2569')).toBeTruthy();
    expect(within(day14).getByTestId('day-total-2026-11-14').textContent).toBe('฿115.00');

    // 13 Nov: income +฿500.00 in green (text-positive)
    const day13 = screen.getByTestId('day-group-2026-11-13');
    const day13Total = within(day13).getByTestId('day-total-2026-11-13');
    expect(day13Total.textContent).toBe('+฿500.00');
    expect(day13Total.querySelector('.text-positive')).toBeTruthy();
    const row13Amount = within(day13).getByRole('button').querySelector('.text-positive');
    expect(row13Amount?.textContent).toBe('+฿500.00');

    // 12 Nov: ฿85.00 + ฿65.00 = ฿150.00
    const day12 = screen.getByTestId('day-group-2026-11-12');
    expect(within(day12).getByTestId('day-total-2026-11-12').textContent).toBe('฿150.00');

    // Descending date order: 14 before 13 before 12
    expect(day14.compareDocumentPosition(day13) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(day13.compareDocumentPosition(day12) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('filters transactions by payment source using SegmentedControl and updates daily totals', () => {
    const extra: Transaction[] = [
      {
        id: 'tx-nov-card',
        date: '2026-11-12',
        amount: 6_500,
        direction: 'out',
        sourceId: 'src-card',
        potId: 'pot-play',
        category: 'food',
        note: 'กาแฟ',
        createdAt: '2026-11-12T10:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
    ];
    render(<StatefulHarness initial={makeFixtureClone(extra)} />);

    const sourceList = screen.getByRole('tablist', { name: 'กรองช่องทาง' });

    // Filter to บัตรเครดิต
    fireEvent.click(within(sourceList).getByRole('tab', { name: 'บัตรเครดิต' }));
    expect(screen.getByText('กาแฟ')).toBeTruthy();
    expect(screen.queryByText('ชานม')).toBeNull();
    expect(screen.queryByText('หนัง')).toBeNull();
    expect(screen.getByTestId('day-total-2026-11-12').textContent).toBe('฿65.00');

    // Filter to SPayLater (none in this period) -> EmptyState
    fireEvent.click(within(sourceList).getByRole('tab', { name: 'SPayLater' }));
    expect(screen.getByText('ยังไม่มีรายการในรอบนี้')).toBeTruthy();

    // Restore to ทั้งหมด
    fireEvent.click(within(sourceList).getByRole('tab', { name: 'ทั้งหมด' }));
    expect(screen.getByText('ชานม')).toBeTruthy();
    expect(screen.getByText('กาแฟ')).toBeTruthy();
    expect(screen.getByTestId('day-total-2026-11-12').textContent).toBe('฿150.00');
  });

  it('switches pay periods (รอบนี้ / รอบก่อน / 2 รอบก่อน) and shows EmptyState when empty', () => {
    render(<StatefulHarness initial={makeFixtureClone()} />);

    const periodList = screen.getByRole('tablist', { name: 'รอบเงินเดือน' });

    // Previous period: 2026-10-10 to 2026-11-09 has tx-oct-adj ('ปรับยอดยกมา')
    fireEvent.click(within(periodList).getByRole('tab', { name: 'รอบก่อน' }));
    expect(screen.getByText('ปรับยอดยกมา')).toBeTruthy();
    expect(screen.queryByText('หนัง')).toBeNull();

    // Two periods ago: 2026-09-10 to 2026-10-09 has no transactions
    fireEvent.click(within(periodList).getByRole('tab', { name: '2 รอบก่อน' }));
    expect(screen.getByText('ยังไม่มีรายการในรอบนี้')).toBeTruthy();
  });

  it('opens BottomSheet on +, defaults date to today, validates, saves new transaction, and supports undo', async () => {
    render(<StatefulHarness initial={makeFixtureClone()} today="2026-11-15" />);

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('เพิ่มรายการ')).toBeTruthy();

    // Default date is today
    const dateInput = within(dialog).getByLabelText('วันที่') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-11-15');

    // Reject empty amount
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByText('กรอกจำนวนเงินให้ถูกต้อง')).toBeTruthy();
    expect(createSpy).not.toHaveBeenCalled();

    // Fill valid income transaction
    fireEvent.click(within(within(dialog).getByRole('tablist', { name: 'ประเภท' })).getByRole('tab', { name: 'รายรับ' }));
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '10,200' } });
    fireEvent.change(within(dialog).getByLabelText('โน้ต'), { target: { value: 'เงินเดือน' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1_020_000,
        direction: 'in',
        date: '2026-11-15',
        note: 'เงินเดือน',
      }),
    );

    expect(await screen.findByText('บันทึกแล้ว')).toBeTruthy();
    expect(screen.getByTestId('day-total-2026-11-15').textContent).toBe('+฿10,200.00');

    // Undo deletes the created transaction
    fireEvent.click(await screen.findByRole('button', { name: 'เลิกทำ' }));
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('เงินเดือน')).toBeNull());
  });

  it('edits an existing transaction and deletes via HoldToDelete with undo toast', async () => {
    render(<StatefulHarness initial={makeFixtureClone()} />);

    // Click row for 'ชานม'
    fireEvent.click(screen.getByText('ชานม'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('แก้ไขรายการ')).toBeTruthy();
    expect((within(dialog).getByLabelText('จำนวนเงิน') as HTMLInputElement).value).toBe('85');
    expect((within(dialog).getByLabelText('โน้ต') as HTMLInputElement).value).toBe('ชานม');

    // Update note
    fireEvent.change(within(dialog).getByLabelText('โน้ต'), { target: { value: 'ชานมไข่มุก' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx-nov-tea',
        note: 'ชานมไข่มุก',
      }),
    );
    expect(await screen.findByText('ชานมไข่มุก')).toBeTruthy();

    // Open again and HoldToDelete
    fireEvent.click(screen.getByText('ชานมไข่มุก'));
    const editDialog = screen.getByRole('dialog');
    const deleteBtn = within(editDialog).getByRole('button', { name: 'กดค้างเพื่อลบ' });

    vi.useFakeTimers();
    fireEvent.pointerDown(deleteBtn);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    act(() => {
      vi.advanceTimersByTime(ROW_EXIT_MS);
    });
    vi.useRealTimers();

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('tx-nov-tea'));
    await waitFor(() => expect(screen.queryByText('ชานมไข่มุก')).toBeNull());

    // Toast with เลิกทำ restores the deleted transaction
    const deleteToastText = await screen.findByText('ลบรายการแล้ว');
    const deleteToastEl = deleteToastText.closest('li') ?? deleteToastText.parentElement!.parentElement!;
    fireEvent.click(within(deleteToastEl).getByRole('button', { name: 'เลิกทำ' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 8_500,
        note: 'ชานมไข่มุก',
        sourceId: 'src-bank',
      }),
    );
  });

  it('computes net daily totals accurately for mixed income and spend days', () => {
    const extra: Transaction[] = [
      // Nov 13: +1,000 income and 300 spend => net +700 (green +)
      {
        id: 'tx-mix-1-in',
        date: '2026-11-13',
        amount: 100_000,
        direction: 'in',
        sourceId: 'src-bank',
        potId: null,
        category: 'other',
        note: 'ขายของ',
        createdAt: '2026-11-13T10:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
      {
        id: 'tx-mix-1-out',
        date: '2026-11-13',
        amount: 30_000,
        direction: 'out',
        sourceId: 'src-bank',
        potId: 'pot-play',
        category: 'food',
        note: 'ข้าวเย็น',
        createdAt: '2026-11-13T12:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
      // Nov 14: +100 income plus fixture 115 + extra 185 = 300 spend => net -200 (ink, never red)
      {
        id: 'tx-mix-2-in',
        date: '2026-11-14',
        amount: 10_000,
        direction: 'in',
        sourceId: 'src-bank',
        potId: null,
        category: 'other',
        note: 'คืนเงิน',
        createdAt: '2026-11-14T10:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
      {
        id: 'tx-mix-2-out',
        date: '2026-11-14',
        amount: 18_500,
        direction: 'out',
        sourceId: 'src-bank',
        potId: 'pot-play',
        category: 'shopping',
        note: 'ของใช้',
        createdAt: '2026-11-14T12:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
    ];
    render(<StatefulHarness initial={makeFixtureClone(extra)} />);

    const total13 = screen.getByTestId('day-total-2026-11-13');
    expect(total13.textContent).toBe('+฿700.00');
    expect(total13.querySelector('.text-positive')).toBeTruthy();

    const total14 = screen.getByTestId('day-total-2026-11-14');
    expect(total14.textContent).toBe('−฿200.00');
    expect(total14.querySelector('.text-negative')).toBeNull();
  });

  it('handles payDay 31 across short months in payPeriod calculation', () => {
    expect(payPeriod('2026-01-31', 31)).toEqual({
      key: '2026-01',
      start: '2026-01-31',
      end: '2026-02-27',
    });
    expect(payPeriod('2026-02-28', 31)).toEqual({
      key: '2026-02',
      start: '2026-02-28',
      end: '2026-03-30',
    });
  });

  it('filters transactions by budget pot on mobile (375px) and updates daily totals', () => {
    mockMatchMedia(375);
    const extra: Transaction[] = [
      {
        id: 'tx-nov-essential',
        date: '2026-11-12',
        amount: 10_000,
        direction: 'out',
        sourceId: 'src-bank',
        potId: 'pot-essential',
        category: 'bills',
        note: 'ค่าไฟ',
        createdAt: '2026-11-12T10:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
    ];
    render(<StatefulHarness initial={makeFixtureClone(extra)} />);

    const potList = screen.getByRole('tablist', { name: 'กรองก้อนเงิน' });
    expect(within(potList).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'ทุกก้อน',
      'ใช้ตามใจ',
      'ใช้จ่ายจำเป็น',
    ]);

    fireEvent.click(within(potList).getByRole('tab', { name: 'ใช้จ่ายจำเป็น' }));
    expect(screen.getByText('ค่าไฟ')).toBeTruthy();
    expect(screen.queryByText('ชานม')).toBeNull();
    expect(screen.getByTestId('day-total-2026-11-12').textContent).toBe('฿100.00');

    fireEvent.click(within(potList).getByRole('tab', { name: 'ทุกก้อน' }));
    expect(screen.getByText('ชานม')).toBeTruthy();
    expect(screen.getByTestId('day-total-2026-11-12').textContent).toBe('฿185.00');
  });

  it('renders sticky 240px SelectField sidebar on desktop (1280px), chip tabs on 375px/768px, and shares filter state across resize', () => {
    const mm = mockMatchMedia(375);
    const extra: Transaction[] = [
      {
        id: 'tx-nov-essential',
        date: '2026-11-12',
        amount: 10_000,
        direction: 'out',
        sourceId: 'src-card',
        potId: 'pot-essential',
        category: 'bills',
        note: 'ค่าเน็ต',
        createdAt: '2026-11-12T10:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      },
    ];
    const { container } = render(<StatefulHarness initial={makeFixtureClone(extra)} />);

    // 375px: segmented tablists, no <select> filter controls
    expect(screen.getByRole('tablist', { name: 'รอบเงินเดือน' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'กรองก้อนเงิน' })).toBeTruthy();
    expect(screen.getByRole('tablist', { name: 'กรองช่องทาง' })).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'รอบเงินเดือน' })).toBeNull();

    // Select a filter on mobile, then resize to tablet (768px) -> keeps chip tabs
    fireEvent.click(within(screen.getByRole('tablist', { name: 'กรองก้อนเงิน' })).getByRole('tab', { name: 'ใช้จ่ายจำเป็น' }));
    expect(screen.getByText('ค่าเน็ต')).toBeTruthy();
    expect(screen.queryByText('ชานม')).toBeNull();

    act(() => {
      mm.setWidth(768);
    });
    expect(screen.getByRole('tablist', { name: 'กรองช่องทาง' })).toBeTruthy();
    expect(screen.getByText('ค่าเน็ต')).toBeTruthy();

    // Resize to desktop (1280px): 2-column grid with sticky 240px aside and SelectFields (single DOM set)
    act(() => {
      mm.setWidth(1280);
    });

    const layoutGrid = container.querySelector('.lg\\:grid-cols-\\[240px_minmax\\(0\\,1fr\\)\\]');
    expect(layoutGrid).not.toBeNull();
    const filterAside = screen.getByRole('complementary', { name: 'ตัวกรองรายการ' });
    expect(filterAside.className).toContain('lg:sticky');
    expect(screen.queryByRole('tablist', { name: 'กรองช่องทาง' })).toBeNull();

    const periodSelect = screen.getByLabelText('รอบเงินเดือน') as HTMLSelectElement;
    const potSelect = screen.getByLabelText('ก้อนเงิน') as HTMLSelectElement;
    const sourceSelect = screen.getByLabelText('ช่องทาง') as HTMLSelectElement;

    // Preserved pot filter state across breakpoint change
    expect(potSelect.value).toBe('pot-essential');
    expect(screen.getByText('ค่าเน็ต')).toBeTruthy();
    expect(screen.queryByText('ชานม')).toBeNull();

    // Change filters via desktop SelectFields
    fireEvent.change(potSelect, { target: { value: 'all' } });
    expect(screen.getByText('ชานม')).toBeTruthy();

    fireEvent.change(sourceSelect, { target: { value: 'src-card' } });
    expect(screen.getByText('ค่าเน็ต')).toBeTruthy();
    expect(screen.queryByText('ชานม')).toBeNull();

    fireEvent.change(periodSelect, { target: { value: '1' } });
    expect(screen.getByText('ยังไม่มีรายการในรอบนี้')).toBeTruthy();
  });

  it('animates only newly added and deleted rows, with zero row animation on initial load, filter change, or resize', async () => {
    const mm = mockMatchMedia(375);
    const { container } = render(<StatefulHarness initial={makeFixtureClone()} today="2026-11-15" />);

    // Initial load: no row-enter or row-exit
    expect(container.querySelectorAll('.row-enter').length).toBe(0);
    expect(container.querySelectorAll('.row-exit').length).toBe(0);

    // Add new entry -> only that row has .row-enter
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '50' } });
    fireEvent.change(within(dialog).getByLabelText('โน้ต'), { target: { value: 'น้ำเปล่า' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(screen.getByText('น้ำเปล่า')).toBeTruthy());
    expect(container.querySelectorAll('.row-enter').length).toBe(1);
    expect(container.querySelector('.row-enter')?.textContent).toContain('น้ำเปล่า');

    // Change filter and switch back -> zero .row-enter animations
    const sourceList = screen.getByRole('tablist', { name: 'กรองช่องทาง' });
    fireEvent.click(within(sourceList).getByRole('tab', { name: 'บัตรเครดิต' }));
    expect(container.querySelectorAll('.row-enter').length).toBe(0);

    fireEvent.click(within(sourceList).getByRole('tab', { name: 'ทั้งหมด' }));
    expect(screen.getByText('น้ำเปล่า')).toBeTruthy();
    expect(container.querySelectorAll('.row-enter').length).toBe(0);

    // Resize to desktop -> zero .row-enter or .row-exit
    act(() => {
      mm.setWidth(1280);
    });
    expect(container.querySelectorAll('.row-enter').length).toBe(0);
    expect(container.querySelectorAll('.row-exit').length).toBe(0);

    // Delete via HoldToDelete -> plays .row-exit for ROW_EXIT_MS before removal
    fireEvent.click(screen.getByText('น้ำเปล่า'));
    const editDialog = screen.getByRole('dialog');
    const deleteBtn = within(editDialog).getByRole('button', { name: 'กดค้างเพื่อลบ' });

    vi.useFakeTimers();
    fireEvent.pointerDown(deleteBtn);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });

    // Immediately after confirm, row is leaving (not yet removed from data)
    expect(container.querySelectorAll('.row-exit').length).toBe(1);
    expect(container.querySelector('.row-exit')?.getAttribute('data-leaving')).toBe('true');
    expect(deleteSpy).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(ROW_EXIT_MS);
    });
    vi.useRealTimers();

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('น้ำเปล่า')).toBeNull());
  });

  it('shows error toasts with repo error messages when save, update, or delete fails', async () => {
    createSpy.mockRejectedValueOnce(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
    updateSpy.mockRejectedValueOnce(new Error('อัปเดตไม่สำเร็จจากฐานข้อมูล'));
    deleteSpy.mockRejectedValueOnce(new Error('สิทธิ์ไม่เพียงพอ'));

    render(<StatefulHarness initial={makeFixtureClone()} today="2026-11-15" />);

    // 1. Create failure -> error toast shown, dialog stays open
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const addDialog = screen.getByRole('dialog');
    fireEvent.change(within(addDialog).getByLabelText('จำนวนเงิน'), { target: { value: '120' } });
    fireEvent.click(within(addDialog).getByRole('button', { name: 'บันทึก' }));

    expect(await screen.findByText(/เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ปิด' }));

    // 2. Update failure -> error toast shown
    fireEvent.click(screen.getByText('ชานม'));
    const editDialog = screen.getByRole('dialog');
    fireEvent.change(within(editDialog).getByLabelText('โน้ต'), { target: { value: 'ชานมใหม่' } });
    fireEvent.click(within(editDialog).getByRole('button', { name: 'บันทึก' }));

    expect(await screen.findByText(/อัปเดตไม่สำเร็จจากฐานข้อมูล/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();

    // 3. Delete failure -> error toast shown, row stays visible (not stuck in leaving)
    const deleteBtn = within(screen.getByRole('dialog')).getByRole('button', { name: 'กดค้างเพื่อลบ' });
    fireEvent.keyDown(deleteBtn, { key: 'Enter' });
    fireEvent.keyUp(deleteBtn, { key: 'Enter' });
    fireEvent.keyDown(deleteBtn, { key: 'Enter' });

    expect(await screen.findByText(/สิทธิ์ไม่เพียงพอ/)).toBeTruthy();
    expect(screen.getByText('ชานม')).toBeTruthy();
    expect(document.querySelectorAll('.row-exit').length).toBe(0);
  });

  it('supports Phase 2 categories (OUT_CATEGORIES vs IN_CATEGORIES), forces potId=null for in/savings/unknown, and warns when date < latest BalanceCheck in EntrySheet', async () => {
    render(<StatefulHarness initial={makeFixtureClone()} today="2026-11-15" />);

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');

    // Out categories include savings ('เก็บเงิน') and unknown ('ลืมจด')
    const categorySelect = within(dialog).getByLabelText('หมวดหมู่') as HTMLSelectElement;
    expect(Array.from(categorySelect.options).map((o) => o.value)).toEqual([
      'food',
      'transport',
      'shopping',
      'entertainment',
      'health',
      'bills',
      'other',
      'savings',
      'unknown',
    ]);

    // Selecting 'savings' clears potId and forces potId=null on submit
    fireEvent.change(categorySelect, { target: { value: 'savings' } });
    expect(within(dialog).queryByLabelText('ก้อนเงิน')).toBeNull();

    // Entering a date before latest BalanceCheck (2026-11-10) on bank shows C2 warning
    fireEvent.change(within(dialog).getByLabelText('วันที่'), { target: { value: '2026-11-09' } });
    expect(within(dialog).getByText('รายการนี้อยู่ก่อนเช็กยอดล่าสุด จึงไม่เปลี่ยนยอดบัญชี')).toBeTruthy();

    // Switching to 'รายรับ' shows IN_CATEGORIES ('allowance', 'parttime', 'freelance', 'other', 'unknown')
    fireEvent.click(within(within(dialog).getByRole('tablist', { name: 'ประเภท' })).getByRole('tab', { name: 'รายรับ' }));
    const inCategorySelect = within(dialog).getByLabelText('หมวดหมู่') as HTMLSelectElement;
    expect(Array.from(inCategorySelect.options).map((o) => o.value)).toEqual([
      'allowance',
      'parttime',
      'freelance',
      'other',
      'unknown',
    ]);
    expect(inCategorySelect.value).toBe('allowance');
    expect(within(dialog).queryByLabelText('ก้อนเงิน')).toBeNull();

    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '300' } });
    fireEvent.change(inCategorySelect, { target: { value: 'freelance' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 30_000,
        direction: 'in',
        potId: null,
        category: 'freelance',
        date: '2026-11-09',
      }),
    );
  });
});
