import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { financeFixture } from '../../fixtures/finance';
import { AppShell } from '../../components/layout/AppShell';
import { AppToaster } from '../../components/ui/Toaster';
import { HOLD_MS } from '../../components/ui/HoldToDelete';
import { mockMatchMedia } from '../../test/mockMatchMedia';
import type {
  FinanceData,
  PaymentSource,
  Pot,
  RecurringIncome,
  Settings,
  UpdateSettingsInput,
  UpsertPotInput,
  UpsertRecurringIncomeInput,
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
const upsertRecurringIncomeSpy = vi.fn<(input: UpsertRecurringIncomeInput) => Promise<RecurringIncome>>();
const deleteRecurringIncomeSpy = vi.fn<(id: string) => Promise<void>>();

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
  useUpsertRecurringIncome: () => ({
    mutate: (input: UpsertRecurringIncomeInput) => {
      void upsertRecurringIncomeSpy(input);
    },
    mutateAsync: upsertRecurringIncomeSpy,
    isPending: false,
    error: null,
  }),
  useDeleteRecurringIncome: () => ({
    mutate: (id: string) => {
      void deleteRecurringIncomeSpy(id);
    },
    mutateAsync: deleteRecurringIncomeSpy,
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
      {/* Fixed clock: the pay period picker lists periods relative to today (Asia/Bangkok). */}
      <SettingsPage onSignOut={onSignOut} today="2026-11-20" />
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
    recurringIncomes: financeFixture.recurringIncomes.map((r) => ({ ...r })),
  };
}

let nextId = 1;

beforeEach(() => {
  nextId = 1;
  toast.dismiss();
  setPrefSpy.mockReset();

  updateSettingsSpy.mockReset().mockImplementation(async (input) => {
    const updated: Settings = { ...mockData.settings, ...input };
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
  upsertRecurringIncomeSpy.mockReset().mockImplementation(async (input) => {
    const saved: RecurringIncome = { id: input.id ?? `inc-new-${nextId++}`, ...input };
    const exists = mockData.recurringIncomes.some((r) => r.id === saved.id);
    const nextRecurring = exists
      ? mockData.recurringIncomes.map((r) => (r.id === saved.id ? saved : r))
      : [...mockData.recurringIncomes, saved];
    setStateHook?.({ ...mockData, recurringIncomes: nextRecurring });
    return saved;
  });
  deleteRecurringIncomeSpy.mockReset().mockImplementation(async (id) => {
    setStateHook?.({
      ...mockData,
      recurringIncomes: mockData.recurringIncomes.filter((r) => r.id !== id),
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
      budgetStartPeriod: null,
    });
  });

  it('offers ไม่กำหนด plus the current pay period and the 11 before it, labelled like the rest of the app', () => {
    render(<StatefulHarness initial={makeFixtureClone()} />);

    const select = screen.getByLabelText('เริ่มนับก้อนเงินตั้งแต่รอบ') as HTMLSelectElement;
    const labels = Array.from(select.options).map((o) => o.textContent);
    expect(labels).toHaveLength(13);
    expect(labels[0]).toBe('ไม่กำหนด');
    expect(labels[1]).toBe('10 พ.ย. – 9 ธ.ค. 2569 (รอบนี้)');
    expect(labels[2]).toBe('10 ต.ค. – 9 พ.ย. 2569');
    // 12th period back from 2026-11 is 2025-12, which crosses the new year.
    expect(labels[12]).toBe('10 ธ.ค. – 9 ม.ค. 2569');
    expect(select.options[1].value).toBe('2026-11');
    expect(select.options[12].value).toBe('2025-12');
    // Nothing stored yet -> "ไม่กำหนด" is selected.
    expect(select.value).toBe('');
  });

  it('saves the chosen budget start period through the settings mutation, and clears it with ไม่กำหนด', async () => {
    render(<StatefulHarness initial={makeFixtureClone()} />);

    fireEvent.change(screen.getByLabelText('เริ่มนับก้อนเงินตั้งแต่รอบ'), { target: { value: '2026-11' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(updateSettingsSpy).toHaveBeenCalledTimes(1));
    expect(updateSettingsSpy).toHaveBeenLastCalledWith({
      salary: 1_020_000,
      payDay: 10,
      budgetStartPeriod: '2026-11',
    });

    // The form re-initialises from the saved value, so the select now shows it.
    await waitFor(() =>
      expect((screen.getByLabelText('เริ่มนับก้อนเงินตั้งแต่รอบ') as HTMLSelectElement).value).toBe('2026-11'),
    );

    fireEvent.change(screen.getByLabelText('เริ่มนับก้อนเงินตั้งแต่รอบ'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(updateSettingsSpy).toHaveBeenCalledTimes(2));
    expect(updateSettingsSpy).toHaveBeenLastCalledWith({
      salary: 1_020_000,
      payDay: 10,
      budgetStartPeriod: null,
    });
  });

  it('keeps a stored start period that is older than the 12-period window selectable', () => {
    const data = makeFixtureClone();
    data.settings.budgetStartPeriod = '2025-06';
    render(<StatefulHarness initial={data} />);

    const select = screen.getByLabelText('เริ่มนับก้อนเงินตั้งแต่รอบ') as HTMLSelectElement;
    expect(select.value).toBe('2025-06');
    expect(select.options[select.selectedIndex].textContent).toBe('10 มิ.ย. – 9 ก.ค. 2568');
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

  it('arranges sections in a single column on 375/768px and 2 balanced columns on 1280px desktop', () => {
    function renderInShell(width: number) {
      mockMatchMedia(width);
      return render(
        <MemoryRouter initialEntries={['/settings']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppShell>
            <StatefulHarness initial={makeFixtureClone()} />
          </AppShell>
        </MemoryRouter>,
      );
    }

    // 375px mobile: TabBar, single-column grid base + lg:grid-cols-2
    renderInShell(375);
    expect(document.querySelector('aside')).toBeNull();
    const mobileGrid = screen.getByTestId('settings-grid');
    expect(mobileGrid.className).toContain('grid-cols-1');
    expect(mobileGrid.className).toContain('lg:grid-cols-2');
    expect(mobileGrid.className).toContain('lg:items-start');
    // 4 grid items: [เงินเดือน & รอบ] | [ช่องทางจ่าย] · [ก้อนเงิน] | [ธีม & บัญชี]
    expect(mobileGrid.children).toHaveLength(4);
    expect(within(mobileGrid.children[0] as HTMLElement).getByRole('heading', { name: 'รายได้และรอบเงินเดือน' })).toBeTruthy();
    expect(within(mobileGrid.children[1] as HTMLElement).getByRole('heading', { name: 'ช่องทางจ่าย' })).toBeTruthy();
    expect(within(mobileGrid.children[2] as HTMLElement).getByRole('heading', { name: 'ก้อนเงิน' })).toBeTruthy();
    expect(within(mobileGrid.children[3] as HTMLElement).getByRole('heading', { name: 'ธีม' })).toBeTruthy();
    expect(within(mobileGrid.children[3] as HTMLElement).getByRole('button', { name: 'ออกจากระบบ' })).toBeTruthy();

    cleanup();

    // 768px tablet: still TabBar + single column before lg:
    renderInShell(768);
    expect(document.querySelector('aside')).toBeNull();
    expect(screen.getByTestId('settings-grid').className).toContain('grid-cols-1');

    cleanup();

    // 1280px desktop: SideNav + 2-column grid
    renderInShell(1280);
    expect(document.querySelector('aside')).not.toBeNull();
    const desktopGrid = screen.getByTestId('settings-grid');
    expect(desktopGrid.className).toContain('lg:grid-cols-2');
    expect(desktopGrid.className).toContain('lg:items-start');
  });

  it('animates payment sources with AnimatedRow on add, delete, archive, and unarchive without initial-load animation', async () => {
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
    const { container } = render(<StatefulHarness initial={makeFixtureClone([unlinkedSource])} />);

    // 1. Initial load: no row-enter or row-exit
    expect(container.querySelectorAll('.row-enter')).toHaveLength(0);
    expect(container.querySelectorAll('.row-exit')).toHaveLength(0);

    // 2. Add a new source -> only the newly added row gets .row-enter
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มช่องทาง' }));
    const addDialog = screen.getByRole('dialog');
    fireEvent.change(within(addDialog).getByLabelText('ชื่อช่องทาง'), { target: { value: 'กระเป๋าใหม่' } });
    fireEvent.click(within(addDialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(screen.getByText('กระเป๋าใหม่')).toBeTruthy());
    expect(await screen.findByText('บันทึกช่องทางจ่ายแล้ว')).toBeTruthy();
    const newRowWrapper = screen.getByText('กระเป๋าใหม่').closest('.row-enter');
    expect(newRowWrapper).not.toBeNull();
    expect(container.querySelectorAll('.row-enter')).toHaveLength(1);

    // 3. Archive an active source -> leaves active with .row-exit then unmounts, enters archived with .row-enter
    fireEvent.click(screen.getByText('บัตรเครดิต'));
    const archiveDialog = screen.getByRole('dialog');
    fireEvent.click(within(archiveDialog).getByRole('button', { name: 'เก็บถาวรช่องทาง' }));

    await waitFor(() => expect(upsertSourceSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'src-card', archived: true })));
    expect(await screen.findByText('เก็บถาวรช่องทางแล้ว')).toBeTruthy();
    expect(container.querySelectorAll('.row-exit')).toHaveLength(1);
    const archivedHeading = screen.getByText('เก็บถาวรแล้ว');
    const archivedCard = archivedHeading.parentElement!;
    expect(within(archivedCard).getByText('บัตรเครดิต').closest('.row-enter')).not.toBeNull();

    // After ROW_EXIT_MS, the leaving row in active sources unmounts.
    await waitFor(() => expect(container.querySelectorAll('.row-exit')).toHaveLength(0));

    // 4. Unarchive the archived source -> leaves archived with .row-exit, enters active with .row-enter
    fireEvent.click(within(archivedCard).getByText('บัตรเครดิต'));
    const unarchiveDialog = screen.getByRole('dialog');
    fireEvent.click(within(unarchiveDialog).getByRole('button', { name: 'นำกลับมาใช้งาน' }));

    await waitFor(() => expect(upsertSourceSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'src-card', archived: false })));
    expect(await screen.findByText('นำช่องทางกลับมาใช้แล้ว')).toBeTruthy();
    expect(container.querySelectorAll('.row-exit')).toHaveLength(1);

    await waitFor(() => expect(container.querySelectorAll('.row-exit')).toHaveLength(0));
    expect(screen.queryByText('เก็บถาวรแล้ว')).toBeNull();

    // 5. Delete an unlinked source -> plays .row-exit for ROW_EXIT_MS then unmounts
    fireEvent.click(screen.getByText('บัญชีสำรอง'));
    const deleteDialog = screen.getByRole('dialog');
    const holdBtn = within(deleteDialog).getByRole('button', { name: 'กดค้างเพื่อลบช่องทาง' });

    vi.useFakeTimers();
    fireEvent.pointerDown(holdBtn);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    vi.useRealTimers();

    await waitFor(() => expect(deleteSourceSpy).toHaveBeenCalledWith('src-unused'));
    expect(await screen.findByText('ลบช่องทางแล้ว')).toBeTruthy();
    expect(screen.getByText('บัญชีสำรอง').closest('.row-exit')).not.toBeNull();

    await waitFor(() => expect(screen.queryByText('บัญชีสำรอง')).toBeNull());
  });

  it('animates pots with AnimatedRow on add and delete without initial-load animation', async () => {
    const unlinkedPot: Pot = {
      id: 'pot-unused',
      name: 'ก้อนสำรอง',
      perPeriod: 50_000,
      rollover: false,
      hue: 'rose',
    };
    const initial = makeFixtureClone();
    initial.pots = [...initial.pots, unlinkedPot];
    const { container } = render(<StatefulHarness initial={initial} />);

    expect(container.querySelectorAll('.row-enter')).toHaveLength(0);

    // Add a pot
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มก้อนเงิน' }));
    const addDialog = screen.getByRole('dialog');
    fireEvent.change(within(addDialog).getByLabelText('ชื่อก้อนเงิน'), { target: { value: 'ออมท่องเที่ยว' } });
    fireEvent.change(within(addDialog).getByLabelText('งบต่อรอบ'), { target: { value: '2,000' } });
    fireEvent.click(within(addDialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(screen.getByText('ออมท่องเที่ยว')).toBeTruthy());
    expect(await screen.findByText('บันทึกก้อนเงินแล้ว')).toBeTruthy();
    expect(screen.getByText('ออมท่องเที่ยว').closest('.row-enter')).not.toBeNull();

    // Delete unlinked pot
    fireEvent.click(screen.getByText('ก้อนสำรอง'));
    const deleteDialog = screen.getByRole('dialog');
    const holdBtn = within(deleteDialog).getByRole('button', { name: 'กดค้างเพื่อลบ' });

    vi.useFakeTimers();
    fireEvent.pointerDown(holdBtn);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    vi.useRealTimers();

    await waitFor(() => expect(deletePotSpy).toHaveBeenCalledWith('pot-unused'));
    expect(await screen.findByText('ลบก้อนเงินแล้ว')).toBeTruthy();
    expect(screen.getByText('ก้อนสำรอง').closest('.row-exit')).not.toBeNull();

    await waitFor(() => expect(screen.queryByText('ก้อนสำรอง')).toBeNull());
  });

  it('shows error toasts with repo error message when save, archive, or delete mutations fail', async () => {
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
    const unlinkedPot: Pot = {
      id: 'pot-unused',
      name: 'ก้อนสำรอง',
      perPeriod: 50_000,
      rollover: false,
      hue: 'rose',
    };
    const initial = makeFixtureClone([unlinkedSource]);
    initial.pots = [...initial.pots, unlinkedPot];

    render(<StatefulHarness initial={initial} />);

    // 1. Settings save error
    updateSettingsSpy.mockRejectedValueOnce(new Error('บันทึกการตั้งค่าไม่สำเร็จ'));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึก' }));
    const settingsErr = await screen.findByText('บันทึกการตั้งค่าไม่สำเร็จ');
    expect(settingsErr.closest('[data-sonner-toast]')?.getAttribute('data-type')).toBe('error');

    // 2. Source save error (sheet stays open)
    upsertSourceSpy.mockRejectedValueOnce(new Error('บันทึกช่องทางจ่ายไม่สำเร็จ'));
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มช่องทาง' }));
    const srcDialog = screen.getByRole('dialog');
    fireEvent.change(within(srcDialog).getByLabelText('ชื่อช่องทาง'), { target: { value: 'ช่องทางพลาด' } });
    fireEvent.click(within(srcDialog).getByRole('button', { name: 'บันทึก' }));
    const srcSaveErr = await screen.findByText('บันทึกช่องทางจ่ายไม่สำเร็จ');
    expect(srcSaveErr.closest('[data-sonner-toast]')?.getAttribute('data-type')).toBe('error');
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(within(srcDialog).getByRole('button', { name: 'ปิด' }));

    // 3. Source delete error (row stays without .row-exit)
    deleteSourceSpy.mockRejectedValueOnce(new Error('ลบช่องทางจ่ายไม่สำเร็จ'));
    fireEvent.click(screen.getByText('บัญชีสำรอง'));
    const srcDelDialog = screen.getByRole('dialog');
    const holdSrcBtn = within(srcDelDialog).getByRole('button', { name: 'กดค้างเพื่อลบช่องทาง' });
    vi.useFakeTimers();
    fireEvent.pointerDown(holdSrcBtn);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    vi.useRealTimers();
    const srcDelErr = await screen.findByText('ลบช่องทางจ่ายไม่สำเร็จ');
    expect(srcDelErr.closest('[data-sonner-toast]')?.getAttribute('data-type')).toBe('error');
    expect(screen.getByText('บัญชีสำรอง').closest('.row-exit')).toBeNull();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ปิด' }));

    // 4. Pot save error
    upsertPotSpy.mockRejectedValueOnce(new Error('บันทึกก้อนเงินไม่สำเร็จ'));
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มก้อนเงิน' }));
    const potDialog = screen.getByRole('dialog');
    fireEvent.change(within(potDialog).getByLabelText('ชื่อก้อนเงิน'), { target: { value: 'ก้อนพลาด' } });
    fireEvent.change(within(potDialog).getByLabelText('งบต่อรอบ'), { target: { value: '500' } });
    fireEvent.click(within(potDialog).getByRole('button', { name: 'บันทึก' }));
    const potSaveErr = await screen.findByText('บันทึกก้อนเงินไม่สำเร็จ');
    expect(potSaveErr.closest('[data-sonner-toast]')?.getAttribute('data-type')).toBe('error');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ปิด' }));

    // 5. Pot delete error
    deletePotSpy.mockRejectedValueOnce(new Error('ลบก้อนเงินไม่สำเร็จ'));
    fireEvent.click(screen.getByText('ก้อนสำรอง'));
    const potDelDialog = screen.getByRole('dialog');
    const holdPotBtn = within(potDelDialog).getByRole('button', { name: 'กดค้างเพื่อลบ' });
    vi.useFakeTimers();
    fireEvent.pointerDown(holdPotBtn);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    vi.useRealTimers();
    const potDelErr = await screen.findByText('ลบก้อนเงินไม่สำเร็จ');
    expect(potDelErr.closest('[data-sonner-toast]')?.getAttribute('data-type')).toBe('error');
    expect(screen.getByText('ก้อนสำรอง').closest('.row-exit')).toBeNull();
  });

  it('adds, edits, and deletes recurring incomes in "เงินประจำ" with validation and error toast', async () => {
    render(<StatefulHarness initial={makeFixtureClone()} />);

    const section = screen.getByTestId('recurring-incomes-section');
    expect(within(section).getAllByText('เงินจากแม่')).toHaveLength(2);
    expect(within(section).getByText('วันที่ 10 ของเดือน · บัญชี')).toBeTruthy();
    expect(within(section).getByText('วันที่ 24 ของเดือน · บัญชี')).toBeTruthy();

    // Open add sheet and trigger validation first
    fireEvent.click(within(section).getByRole('button', { name: 'เพิ่มเงินประจำ' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByText('กรอกชื่อรายการ')).toBeTruthy();
    expect(within(dialog).getByText('กรอกจำนวนเงินให้ถูกต้อง')).toBeTruthy();
    expect(within(dialog).getByText('กรุณาระบุวันที่ 1–31')).toBeTruthy();
    expect(upsertRecurringIncomeSpy).not.toHaveBeenCalled();

    // Fill valid values and save
    fireEvent.change(within(dialog).getByLabelText('ชื่อรายการ'), { target: { value: 'ค่าจ้างพิเศษ' } });
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '3500' } });
    fireEvent.change(within(dialog).getByLabelText('วันที่เข้าของเดือน (1–31)'), { target: { value: '15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(upsertRecurringIncomeSpy).toHaveBeenCalledTimes(1));
    expect(upsertRecurringIncomeSpy).toHaveBeenCalledWith({
      name: 'ค่าจ้างพิเศษ',
      amount: 350_000,
      dayOfMonth: 15,
      sourceId: 'src-bank',
      active: true,
    });
    expect(await within(section).findByText('ค่าจ้างพิเศษ')).toBeTruthy();

    // Edit existing item
    fireEvent.click(within(section).getByText('ค่าจ้างพิเศษ'));
    const editDialog = screen.getByRole('dialog');
    fireEvent.change(within(editDialog).getByLabelText('วันที่เข้าของเดือน (1–31)'), { target: { value: '20' } });
    fireEvent.click(within(editDialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(upsertRecurringIncomeSpy).toHaveBeenCalledTimes(2));
    expect(upsertRecurringIncomeSpy).toHaveBeenLastCalledWith({
      id: 'inc-new-1',
      name: 'ค่าจ้างพิเศษ',
      amount: 350_000,
      dayOfMonth: 20,
      sourceId: 'src-bank',
      active: true,
    });
    expect(await within(section).findByText('วันที่ 20 ของเดือน · บัญชี')).toBeTruthy();

    // Error toast shows Thai error message on delete failure
    deleteRecurringIncomeSpy.mockRejectedValueOnce('unknown error');
    fireEvent.click(within(section).getByText('ค่าจ้างพิเศษ'));
    const deleteDialog = screen.getByRole('dialog');
    vi.useFakeTimers();
    fireEvent.pointerDown(within(deleteDialog).getByRole('button', { name: 'กดค้างเพื่อลบ' }));
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    vi.useRealTimers();
    const errToast = await screen.findByText('ลบเงินประจำไม่สำเร็จ');
    expect(errToast.closest('[data-sonner-toast]')?.getAttribute('data-type')).toBe('error');

    // Successful hold-to-delete
    vi.useFakeTimers();
    fireEvent.pointerDown(within(screen.getByRole('dialog')).getByRole('button', { name: 'กดค้างเพื่อลบ' }));
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    vi.useRealTimers();
    await waitFor(() => expect(deleteRecurringIncomeSpy).toHaveBeenCalledWith('inc-new-1'));
  });
});
