import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { AppToaster } from './ui/Toaster';
import { financeFixture } from '../fixtures/finance';
import * as domain from '../domain';
import * as financeHooks from '../hooks/useFinance';
import type { ConfirmIncomeInput, ISODate, PendingIncome, Transaction } from '../types/finance';
import { IncomeDueCard } from './IncomeDueCard';

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}

vi.mock('./ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

const TODAY: ISODate = '2026-11-24';

const SAMPLE_PENDING: PendingIncome[] = [
  {
    recurringIncomeId: 'inc-mom-24',
    name: 'เงินจากแม่',
    amount: 510_000,
    sourceId: 'src-bank',
    dueOn: '2026-11-24',
  },
];

let confirmIncomeSpy = vi.fn<(input: ConfirmIncomeInput) => Promise<Transaction>>();
let memStorage: Map<string, string>;

beforeEach(() => {
  memStorage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memStorage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memStorage.set(k, v);
    },
    removeItem: (k: string) => {
      memStorage.delete(k);
    },
    clear: () => {
      memStorage.clear();
    },
  });
  confirmIncomeSpy = vi.fn(async (input) => ({
    id: 'tx-inc-1',
    date: input.date,
    amount: input.amount,
    direction: 'in',
    sourceId: input.sourceId ?? 'src-bank',
    potId: null,
    category: 'allowance',
    note: input.note ?? 'เงินจากแม่',
    createdAt: `${input.date}T08:00:00.000Z`,
    recurringIncomeId: input.recurringIncomeId,
    incomeDueOn: input.incomeDueOn,
  }));

  vi.spyOn(financeHooks, 'useConfirmIncome').mockImplementation(() => ({
    mutate: (input) => {
      void confirmIncomeSpy(input);
    },
    mutateAsync: confirmIncomeSpy,
    isPending: false,
    error: null,
  }));
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('<IncomeDueCard>', () => {
  it('renders nothing when pendingIncomes returns empty or throws not implemented', () => {
    vi.spyOn(domain, 'pendingIncomes').mockReturnValue([]);
    const { container, rerender } = render(<IncomeDueCard data={financeFixture} today={TODAY} />);
    expect(container.firstChild).toBeNull();

    vi.spyOn(domain, 'pendingIncomes').mockImplementation(() => {
      throw new Error('not implemented: pendingIncomes');
    });
    rerender(<IncomeDueCard data={financeFixture} today={TODAY} />);
    expect(container.firstChild).toBeNull();
  });

  it('confirms pending income in one click with confirmIncome and shows toast', async () => {
    vi.spyOn(domain, 'pendingIncomes').mockReturnValue(SAMPLE_PENDING);
    const { container } = render(
      <>
        <IncomeDueCard data={financeFixture} today={TODAY} />
        <AppToaster />
      </>,
    );

    expect(screen.getByText(/เงินจากแม่เข้าแล้ว\?/)).toBeTruthy();
    expect(container.textContent).toContain('฿5,100.00');

    fireEvent.click(screen.getByRole('button', { name: 'เข้าแล้ว' }));

    await waitFor(() => expect(confirmIncomeSpy).toHaveBeenCalledTimes(1));
    expect(confirmIncomeSpy).toHaveBeenCalledWith({
      recurringIncomeId: 'inc-mom-24',
      incomeDueOn: '2026-11-24',
      amount: 510_000,
      date: TODAY,
      sourceId: 'src-bank',
      note: 'เงินจากแม่',
    });
    expect(await screen.findByText('บันทึกเงินเข้าแล้ว')).toBeTruthy();
  });

  it('allows editing amount and date via sheet before calling confirmIncome', async () => {
    vi.spyOn(domain, 'pendingIncomes').mockReturnValue(SAMPLE_PENDING);
    render(
      <>
        <IncomeDueCard data={financeFixture} today={TODAY} />
        <AppToaster />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'แก้ยอด/วัน' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '4800' } });
    fireEvent.change(within(dialog).getByLabelText('วันที่รับเงิน'), { target: { value: '2026-11-25' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยืนยันเงินเข้า' }));

    await waitFor(() => expect(confirmIncomeSpy).toHaveBeenCalledTimes(1));
    expect(confirmIncomeSpy).toHaveBeenCalledWith({
      recurringIncomeId: 'inc-mom-24',
      incomeDueOn: '2026-11-24',
      amount: 480_000,
      date: '2026-11-25',
      sourceId: 'src-bank',
      note: 'เงินจากแม่',
    });
  });

  it('hides card until tomorrow when "ยังไม่เข้า" is clicked and survives localStorage failure', () => {
    vi.spyOn(domain, 'pendingIncomes').mockReturnValue(SAMPLE_PENDING);
    const { rerender } = render(<IncomeDueCard data={financeFixture} today={TODAY} />);

    fireEvent.click(screen.getByRole('button', { name: 'ยังไม่เข้า' }));
    expect(screen.queryByText(/เงินจากแม่เข้าแล้ว\?/)).toBeNull();

    // Still hidden if re-rendered on the same day.
    rerender(<IncomeDueCard data={financeFixture} today={TODAY} />);
    expect(screen.queryByText(/เงินจากแม่เข้าแล้ว\?/)).toBeNull();

    // Reappears tomorrow.
    rerender(<IncomeDueCard data={financeFixture} today="2026-11-25" />);
    expect(screen.getByText(/เงินจากแม่เข้าแล้ว\?/)).toBeTruthy();

    // Also works without crashing when localStorage throws.
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ยังไม่เข้า' }));
    expect(screen.queryByText(/เงินจากแม่เข้าแล้ว\?/)).toBeNull();
  });

  it('shows error toast when confirmIncome fails', async () => {
    confirmIncomeSpy.mockRejectedValueOnce(new Error('เชื่อมต่อไม่สำเร็จ'));
    vi.spyOn(domain, 'pendingIncomes').mockReturnValue(SAMPLE_PENDING);
    render(
      <>
        <IncomeDueCard data={financeFixture} today={TODAY} />
        <AppToaster />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'เข้าแล้ว' }));
    const err = await screen.findByText(/เชื่อมต่อไม่สำเร็จ/);
    expect(err.closest('[data-sonner-toast]')?.getAttribute('data-type')).toBe('error');
  });
});
