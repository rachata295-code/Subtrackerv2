import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { AppToaster } from './ui/Toaster';
import { HotBar } from './HotBar';
import * as domain from '../domain';
import * as financeHooks from '../hooks/useFinance';
import { financeFixture } from '../fixtures/finance';
import type { CreateTransactionInput, HotbarItem, ISODate, Transaction } from '../types/finance';

vi.mock('./ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

const TODAY: ISODate = '2026-11-15';

// Matches SPEC §4 B3 hotbar output for financeFixture on 2026-11-15.
const FIXTURE_HOTBAR_ITEMS: HotbarItem[] = [
  {
    note: 'ข้าวมันไก่',
    amount: 4_500,
    category: 'food',
    sourceId: 'src-bank',
    potId: 'pot-essential',
    count: 3,
    lastDate: '2026-11-08',
  },
  {
    note: 'ชานม',
    amount: 8_500,
    category: 'food',
    sourceId: 'src-bank',
    potId: 'pot-essential',
    count: 2,
    lastDate: '2026-11-06',
  },
];

let createTxSpy = vi.fn<(input: CreateTransactionInput) => Promise<Transaction>>();
let deleteTxSpy = vi.fn<(id: string) => Promise<void>>();

beforeEach(() => {
  createTxSpy = vi.fn(async (input) => ({
    id: 'tx-hotbar-1',
    ...input,
    createdAt: `${input.date}T12:00:00.000Z`,
    recurringIncomeId: null,
    incomeDueOn: null,
  }));
  deleteTxSpy = vi.fn(async () => {});

  const origHotbar = domain.hotbarItems;
  vi.spyOn(domain, 'hotbarItems').mockImplementation((data, today, limit) => {
    try {
      return origHotbar(data, today, limit);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('not implemented')) {
        return data.transactions.length === 0 ? [] : FIXTURE_HOTBAR_ITEMS;
      }
      throw err;
    }
  });

  vi.spyOn(financeHooks, 'useCreateTransaction').mockImplementation(() => ({
    mutate: (input) => {
      void createTxSpy(input);
    },
    mutateAsync: createTxSpy,
    isPending: false,
    error: null,
  }));

  vi.spyOn(financeHooks, 'useDeleteTransaction').mockImplementation(() => ({
    mutate: (id) => {
      void deleteTxSpy(id);
    },
    mutateAsync: deleteTxSpy,
    isPending: false,
    error: null,
  }));
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('<HotBar>', () => {
  it('renders nothing when hotbarItems returns an empty list', () => {
    vi.spyOn(domain, 'hotbarItems').mockReturnValue([]);
    const { container } = render(
      <>
        <HotBar data={financeFixture} today={TODAY} />
        <AppToaster />
      </>,
    );
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders horizontal scrollable .pressable buttons with >= 44px tap targets', () => {
    render(
      <>
        <HotBar data={financeFixture} today={TODAY} />
        <AppToaster />
      </>,
    );

    const riceBtn = screen.getByRole('button', { name: 'ข้าวมันไก่ ฿45' });
    const teaBtn = screen.getByRole('button', { name: 'ชานม ฿85' });
    expect(riceBtn.className).toContain('pressable');
    expect(riceBtn.className).toContain('min-h-tap');
    expect(teaBtn.className).toContain('pressable');
    expect(teaBtn.className).toContain('min-h-tap');
    expect(riceBtn.parentElement?.className).toContain('overflow-x-auto');
  });

  it('saves immediately on tap, shows 5s undo toast, and deletes on undo', async () => {
    const onSaved = vi.fn();
    render(
      <>
        <HotBar data={financeFixture} today={TODAY} onSaved={onSaved} />
        <AppToaster />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ข้าวมันไก่ ฿45' }));

    await waitFor(() => expect(createTxSpy).toHaveBeenCalledTimes(1));
    expect(createTxSpy).toHaveBeenCalledWith({
      date: TODAY,
      amount: 4_500,
      direction: 'out',
      sourceId: 'src-bank',
      potId: 'pot-essential',
      category: 'food',
      note: 'ข้าวมันไก่',
    });
    expect(onSaved).toHaveBeenCalledTimes(1);

    expect(await screen.findByText('บันทึกข้าวมันไก่ ฿45')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'เลิกทำ' }));
    await waitFor(() => expect(deleteTxSpy).toHaveBeenCalledWith('tx-hotbar-1'));
  });

  it('calls onEdit after 500ms long-press without triggering a quick save', () => {
    vi.useFakeTimers();
    const onEdit = vi.fn();

    render(
      <>
        <HotBar data={financeFixture} today={TODAY} onEdit={onEdit} />
        <AppToaster />
      </>,
    );

    const teaBtn = screen.getByRole('button', { name: 'ชานม ฿85' });
    fireEvent.pointerDown(teaBtn, { button: 0, clientX: 10, clientY: 10 });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(onEdit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(FIXTURE_HOTBAR_ITEMS[1]);

    // Completing the press/click after long-press must not trigger quick-save.
    fireEvent.pointerUp(teaBtn);
    fireEvent.click(teaBtn);
    expect(createTxSpy).not.toHaveBeenCalled();
  });

  it('calls onEdit on right-click (contextmenu) without triggering a quick save', () => {
    const onEdit = vi.fn();

    render(
      <>
        <HotBar data={financeFixture} today={TODAY} onEdit={onEdit} />
        <AppToaster />
      </>,
    );

    const riceBtn = screen.getByRole('button', { name: 'ข้าวมันไก่ ฿45' });
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    riceBtn.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(FIXTURE_HOTBAR_ITEMS[0]);
    expect(createTxSpy).not.toHaveBeenCalled();
  });

  it('shows a Thai error toast and does not crash when quick save fails', async () => {
    createTxSpy = vi.fn(async () => {
      throw new Error('เชื่อมต่อไม่ได้');
    });

    render(
      <>
        <HotBar data={financeFixture} today={TODAY} />
        <AppToaster />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ข้าวมันไก่ ฿45' }));
    expect(await screen.findByText(/บันทึกไม่สำเร็จ.*เชื่อมต่อไม่ได้/)).toBeTruthy();
  });
});
