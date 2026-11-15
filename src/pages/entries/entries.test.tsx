import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { financeFixture } from '../../fixtures/finance';
import { AppToaster } from '../../components/ui/Toaster';
import { HOLD_MS } from '../../components/ui/HoldToDelete';
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

function StatefulHarness({ initial, today = '2026-11-15' }: { initial: FinanceData; today?: string }) {
  const [state, setState] = useState<FinanceData>(initial);
  mockData = state;
  setStateHook = setState;
  return (
    <>
      <EntriesPage today={today} />
      <AppToaster />
    </>
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
    const created: Transaction = { id: `tx-new-${nextId++}`, ...input };
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
});
