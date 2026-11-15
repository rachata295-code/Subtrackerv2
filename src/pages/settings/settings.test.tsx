import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { financeFixture } from '../../fixtures/finance';
import { AppToaster } from '../../components/ui/Toaster';
import { HOLD_MS } from '../../components/ui/HoldToDelete';
import type {
  FinanceData,
  PaymentSource,
  Pot,
  Settings,
  UpdateSettingsInput,
  UpsertPotInput,
  UpsertSourceInput,
} from '../../types/finance';

// Vaul calls setPointerCapture/releasePointerCapture on pointerDown inside BottomSheet; jsdom omits them.
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}

// Mock ThemeProvider & ThemeSwitch stays interactive via mock state
const setPrefSpy = vi.fn();
vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'system', resolved: 'light', setPref: setPrefSpy }),
}));

let mockData: FinanceData;
let setStateHook: ((next: FinanceData) => void) | null = null;

const updateSettingsSpy = vi.fn<(input: UpdateSettingsInput) => Promise<Settings>>();
const upsertSourceSpy = vi.fn<(input: UpsertSourceInput) => Promise<PaymentSource>>();
const deleteSourceSpy = vi.fn<(id: string) => Promise<void>>();
const upsertPotSpy = vi.fn<(input: UpsertPotInput) => Promise<Pot>>();
const deletePotSpy = vi.fn<(id: string) => Promise<void>>();

vi.mock('../../hooks/useFinance', () => ({
  useFinanceData: () => ({ data: mockData, isLoading: false, error: null }),
  useUpdateSettings: () => ({
    mutate: (input: UpdateSettingsInput) => {
      void updateSettingsSpy(input);
    },
    mutateAsync: updateSettingsSpy,
    isPending: false,
    error: null,
  }),
  useUpsertSource: () => ({
    mutate: (input: UpsertSourceInput) => {
      void upsertSourceSpy(input);
    },
    mutateAsync: upsertSourceSpy,
    isPending: false,
    error: null,
  }),
  useDeleteSource: () => ({
    mutate: (id: string) => {
      void deleteSourceSpy(id);
    },
    mutateAsync: deleteSourceSpy,
    isPending: false,
    error: null,
  }),
  useUpsertPot: () => ({
    mutate: (input: UpsertPotInput) => {
      void upsertPotSpy(input);
    },
    mutateAsync: upsertPotSpy,
    isPending: false,
    error: null,
  }),
  useDeletePot: () => ({
    mutate: (id: string) => {
      void deletePotSpy(id);
    },
    mutateAsync: deletePotSpy,
    isPending: false,
    error: null,
  }),
}));

import SettingsPage from './index';

function StatefulHarness({
  initial,
  onSignOut,
}: {
  initial: FinanceData;
  onSignOut?: () => void | Promise<void>;
}) {
  const [state, setState] = useState<FinanceData>(initial);
  mockData = state;
  setStateHook = setState;
  return (
    <>
      <SettingsPage onSignOut={onSignOut} />
      <AppToaster />
    </>
  );
}

function makeFixtureClone(extraSources: PaymentSource[] = []): FinanceData {
  return {
    ...financeFixture,
    settings: { ...financeFixture.settings },
    sources: [...financeFixture.sources.map((s) => ({ ...s })), ...extraSources],
    pots: financeFixture.pots.map((p) => ({ ...p })),
    subscriptions: financeFixture.subscriptions.map((s) => ({ ...s })),
    installments: financeFixture.installments.map((i) => ({ ...i })),
    transactions: financeFixture.transactions.map((t) => ({ ...t })),
    payments: financeFixture.payments.map((p) => ({ ...p })),
  };
}

let nextId = 1;

beforeEach(() => {
  nextId = 1;
  toast.dismiss();
  setPrefSpy.mockReset();

  updateSettingsSpy.mockReset().mockImplementation(async (input) => {
    const updated: Settings = { userId: mockData.settings.userId, ...input };
    setStateHook?.({ ...mockData, settings: updated });
    return updated;
  });
  upsertSourceSpy.mockReset().mockImplementation(async (input) => {
    const saved: PaymentSource = { id: input.id ?? `src-new-${nextId++}`, ...input };
    const exists = mockData.sources.some((s) => s.id === saved.id);
    setStateHook?.({
      ...mockData,
      sources: exists ? mockData.sources.map((s) => (s.id === saved.id ? saved : s)) : [...mockData.sources, saved],
    });
    return saved;
  });
  deleteSourceSpy.mockReset().mockImplementation(async (id) => {
    setStateHook?.({
      ...mockData,
      sources: mockData.sources.filter((s) => s.id !== id),
    });
  });
  upsertPotSpy.mockReset().mockImplementation(async (input) => {
    const saved: Pot = { id: input.id ?? `pot-new-${nextId++}`, ...input };
    const exists = mockData.pots.some((p) => p.id === saved.id);
    setStateHook?.({
      ...mockData,
      pots: exists ? mockData.pots.map((p) => (p.id === saved.id ? saved : p)) : [...mockData.pots, saved],
    });
    return saved;
  });
  deletePotSpy.mockReset().mockImplementation(async (id) => {
    setStateHook?.({
      ...mockData,
      pots: mockData.pots.filter((p) => p.id !== id),
    });
  });
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.useRealTimers();
  setStateHook = null;
});

describe('<SettingsPage>', () => {
  it('validates payDay strictly within 1–31 before saving settings', async () => {
    render(<StatefulHarness initial={makeFixtureClone()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'ตั้งค่า' })).toBeTruthy();
    const salaryInput = screen.getByLabelText('เงินเดือน') as HTMLInputElement;
    const payDayInput = screen.getByLabelText('วันเงินเดือนเข้า') as HTMLInputElement;
    expect(salaryInput.value).toBe('10,200');
    expect(payDayInput.value).toBe('10');

    // Invalid: 0 and 32 and non-integer
    for (const invalidDay of ['0', '32', '10.5', '']) {
      fireEvent.change(payDayInput, { target: { value: invalidDay } });
      fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
      expect(payDayInput.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText('กรุณาระบุวันที่ 1–31')).toBeTruthy();
      expect(updateSettingsSpy).not.toHaveBeenCalled();
    }

    // Valid: 31 and updated salary
    fireEvent.change(salaryInput, { target: { value: '15,500' } });
    fireEvent.change(payDayInput, { target: { value: '31' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(updateSettingsSpy).toHaveBeenCalledTimes(1));
    expect(updateSettingsSpy).toHaveBeenCalledWith({
      salary: 1_550_000,
      payDay: 31,
    });
  });

  it('hides billing cycle fields when payment source kind is bank and shows them for credit_card / paylater', async () => {
    render(<StatefulHarness initial={makeFixtureClone()} />);

    // Open add source sheet
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มช่องทาง' }));
    const dialog = screen.getByRole('dialog');

    // Default kind is bank -> billing cycle fields hidden
    expect(within(dialog).queryByLabelText(/วันปิดรอบ/)).toBeNull();
    expect(within(dialog).queryByLabelText(/วันครบกำหนด/)).toBeNull();
    expect(within(dialog).queryByRole('tablist', { name: 'เดือนครบกำหนด' })).toBeNull();
    expect(within(dialog).queryByLabelText('จ่ายจากบัญชี')).toBeNull();

    // Switch to credit_card -> billing cycle fields appear
    const kindList = within(dialog).getByRole('tablist', { name: 'ประเภทช่องทาง' });
    fireEvent.click(within(kindList).getByRole('tab', { name: 'บัตรเครดิต' }));

    expect(within(dialog).getByLabelText(/วันปิดรอบ/)).toBeTruthy();
    expect(within(dialog).getByLabelText(/วันครบกำหนด/)).toBeTruthy();
    expect(within(dialog).getByRole('tablist', { name: 'เดือนครบกำหนด' })).toBeTruthy();
    expect(within(dialog).getByLabelText('จ่ายจากบัญชี')).toBeTruthy();

    // Validate day 1-31 on dueDay
    fireEvent.change(within(dialog).getByLabelText('ชื่อช่องทาง'), { target: { value: 'บัตรใหม่' } });
    fireEvent.change(within(dialog).getByLabelText(/วันครบกำหนด/), { target: { value: '35' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByText('กรุณาระบุวันที่ 1–31')).toBeTruthy();
    expect(upsertSourceSpy).not.toHaveBeenCalled();

    // Switch back to bank -> billing cycle fields hidden again, saves with nulls
    fireEvent.click(within(kindList).getByRole('tab', { name: 'บัญชี' }));
    expect(within(dialog).queryByLabelText(/วันปิดรอบ/)).toBeNull();
    expect(within(dialog).queryByLabelText(/วันครบกำหนด/)).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(upsertSourceSpy).toHaveBeenCalledTimes(1));
    expect(upsertSourceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'บัตรใหม่',
        kind: 'bank',
        statementCloseDay: null,
        dueDay: null,
        dueMonthOffset: null,
        payFromSourceId: null,
      }),
    );
  });

  it('pre-selects an unused hue first from the 6 shades when adding a payment source', () => {
    // fixture uses stone, sky, apricot -> first unused from [sky, apricot, teal, stone, lilac, rose] is teal
    render(<StatefulHarness initial={makeFixtureClone()} />);

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มช่องทาง' }));
    const dialog = screen.getByRole('dialog');
    const hueButtons = within(dialog).getAllByRole('button', { pressed: true });
    expect(hueButtons).toHaveLength(1);
    expect(hueButtons[0].getAttribute('data-hue')).toBe('teal');

    // Unused hues appear first in the picker
    const allHueBtns = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-hue]'));
    expect(allHueBtns.map((b) => b.getAttribute('data-hue'))).toEqual([
      'teal',
      'lilac',
      'rose',
      'sky',
      'apricot',
      'stone',
    ]);
  });

  it('archives instead of deleting a source when it has linked records, and allows HoldToDelete when unlinked', async () => {
    const unlinkedSource: PaymentSource = {
      id: 'src-unused',
      name: 'บัญชีสำรอง',
      kind: 'bank',
      hue: 'lilac',
      archived: false,
      statementCloseDay: null,
      dueDay: null,
      dueMonthOffset: null,
      payFromSourceId: null,
    };
    render(<StatefulHarness initial={makeFixtureClone([unlinkedSource])} />);

    // 1. Source with linked records (บัตรเครดิต has subscriptions/transactions/payments)
    fireEvent.click(screen.getByText('บัตรเครดิต'));
    const cardDialog = screen.getByRole('dialog');
    expect(within(cardDialog).queryByRole('button', { name: /ลบ/ })).toBeNull();
    const archiveBtn = within(cardDialog).getByRole('button', { name: 'เก็บถาวรช่องทาง' });
    fireEvent.click(archiveBtn);

    await waitFor(() => expect(upsertSourceSpy).toHaveBeenCalledTimes(1));
    expect(upsertSourceSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'src-card', archived: true }));
    expect(deleteSourceSpy).not.toHaveBeenCalled();

    // 2. Unlinked source (บัญชีสำรอง) -> HoldToDelete deletes it
    fireEvent.click(screen.getByText('บัญชีสำรอง'));
    const unusedDialog = screen.getByRole('dialog');
    const holdBtn = within(unusedDialog).getByRole('button', { name: 'กดค้างเพื่อลบช่องทาง' });

    vi.useFakeTimers();
    fireEvent.pointerDown(holdBtn);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    vi.useRealTimers();

    await waitFor(() => expect(deleteSourceSpy).toHaveBeenCalledWith('src-unused'));
  });

  it('creates and edits a pot with name, perPeriod, and rollover switch', async () => {
    render(<StatefulHarness initial={makeFixtureClone()} />);

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มก้อนเงิน' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('ชื่อก้อนเงิน'), { target: { value: 'ออมฉุกเฉิน' } });
    fireEvent.change(within(dialog).getByLabelText('งบต่อรอบ'), { target: { value: '1,500' } });
    fireEvent.click(within(dialog).getByRole('switch', { name: 'ยกยอดคงเหลือไปรอบถัดไป' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(upsertPotSpy).toHaveBeenCalledTimes(1));
    expect(upsertPotSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ออมฉุกเฉิน',
        perPeriod: 150_000,
        rollover: true,
      }),
    );
  });

  it('renders ThemeSwitch and calls onSignOut when clicking ออกจากระบบ', () => {
    const onSignOut = vi.fn();
    render(<StatefulHarness initial={makeFixtureClone()} onSignOut={onSignOut} />);

    const themeList = screen.getByRole('tablist', { name: 'ธีม' });
    expect(within(themeList).getAllByRole('tab').map((t) => t.textContent)).toEqual(['ระบบ', 'สว่าง', 'มืด']);
    fireEvent.click(within(themeList).getByRole('tab', { name: 'มืด' }));
    expect(setPrefSpy).toHaveBeenCalledWith('dark');

    fireEvent.click(screen.getByRole('button', { name: 'ออกจากระบบ' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('saves paylater billing fields with calendar-month closeDay null, dueMonthOffset 1, and payFromSourceId', async () => {
    render(<StatefulHarness initial={makeFixtureClone()} />);

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มช่องทาง' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('ชื่อช่องทาง'), { target: { value: 'LazPayLater' } });
    const kindList = within(dialog).getByRole('tablist', { name: 'ประเภทช่องทาง' });
    fireEvent.click(within(kindList).getByRole('tab', { name: 'PayLater' }));

    // Invalid closeDay 0 is rejected
    fireEvent.change(within(dialog).getByLabelText(/วันปิดรอบ/), { target: { value: '0' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByText('กรุณาระบุวันที่ 1–31')).toBeTruthy();
    expect(upsertSourceSpy).not.toHaveBeenCalled();

    // Clear closeDay (= calendar month), set dueDay 15, offset 1, payFrom src-bank
    fireEvent.change(within(dialog).getByLabelText(/วันปิดรอบ/), { target: { value: '' } });
    fireEvent.change(within(dialog).getByLabelText(/วันครบกำหนด/), { target: { value: '15' } });
    fireEvent.change(within(dialog).getByLabelText('จ่ายจากบัญชี'), { target: { value: 'src-bank' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(upsertSourceSpy).toHaveBeenCalledTimes(1));
    expect(upsertSourceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'LazPayLater',
        kind: 'paylater',
        statementCloseDay: null,
        dueDay: 15,
        dueMonthOffset: 1,
        payFromSourceId: 'src-bank',
      }),
    );
  });
});
