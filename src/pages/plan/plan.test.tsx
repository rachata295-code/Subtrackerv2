import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { AppShell } from '../../components/layout/AppShell';
import { ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { HOLD_MS } from '../../components/ui/HoldToDelete';
import { AppToaster } from '../../components/ui/Toaster';
import { financeFixture } from '../../fixtures/finance';
import { mockMatchMedia } from '../../test/mockMatchMedia';
import * as domain from '../../domain';
import * as financeHooks from '../../hooks/useFinance';
import type {
  BalanceCheck,
  CreateBalanceCheckInput,
  CreateTransactionInput,
  FinanceData,
  Forecast,
  HotbarItem,
  ISODate,
  PlanItem,
  Transaction,
  UpsertPlanItemInput,
} from '../../types/finance';
import PlanPage from './index';

if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {};
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {};
}

vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

const TODAY: ISODate = '2026-11-15';

let mockData: FinanceData;
let setDataHook: ((next: FinanceData) => void) | null = null;

const createBalanceCheckSpy = vi.fn<(input: CreateBalanceCheckInput) => Promise<BalanceCheck>>();
const createTxSpy = vi.fn<(input: CreateTransactionInput) => Promise<Transaction>>();
const upsertPlanItemSpy = vi.fn<(input: UpsertPlanItemInput) => Promise<PlanItem>>();
const deletePlanItemSpy = vi.fn<(id: string) => Promise<void>>();
const completePlanItemSpy = vi.fn<(id: string) => Promise<PlanItem>>();
const uncompletePlanItemSpy = vi.fn<(id: string) => Promise<PlanItem>>();

let nextId = 1;

function cloneFixture(): FinanceData {
  return structuredClone(financeFixture);
}

const DEFAULT_FORECAST: Forecast = {
  start: 468_000,
  incoming: 510_000,
  bills: 0,
  plans: 350_000,
  potsLeft: 778_007,
  available: -150_007,
  timeline: [
    {
      date: '2026-11-24',
      kind: 'bill',
      direction: 'out',
      title: 'บิล บัตรเครดิต',
      amount: 107_700,
      balance: 360_300,
    },
    {
      date: '2026-11-24',
      kind: 'income',
      direction: 'in',
      title: 'เงินจากแม่',
      amount: 510_000,
      balance: 870_300,
    },
    {
      date: '2026-11-25',
      kind: 'plan',
      direction: 'out',
      title: 'ค่าหอ',
      amount: 150_000,
      balance: 720_300,
    },
    {
      date: '2026-11-28',
      kind: 'plan',
      direction: 'out',
      title: 'เก็บ',
      amount: 200_000,
      balance: 520_300,
    },
  ],
  low: { date: '2026-11-24', balance: 360_300 },
};

function StatefulPlanHarness({
  initial,
  withShell = false,
}: {
  initial: FinanceData;
  withShell?: boolean;
}) {
  const [state, setState] = useState<FinanceData>(initial);
  mockData = state;
  setDataHook = setState;
  const pageRoute = <Route path="/plan" element={<PlanPage today={TODAY} />} />;
  return (
    <MemoryRouter initialEntries={['/plan']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {withShell ? (
          <Route element={<AppShell />}>
            {pageRoute}
            <Route path="/bills" element={<h1>บิล & ผ่อน</h1>} />
            <Route path="/settings" element={<h1>ตั้งค่า</h1>} />
          </Route>
        ) : (
          <>
            {pageRoute}
            <Route path="/bills" element={<h1>บิล & ผ่อน</h1>} />
            <Route path="/settings" element={<h1>ตั้งค่า</h1>} />
          </>
        )}
      </Routes>
      <AppToaster />
    </MemoryRouter>
  );
}

beforeEach(() => {
  nextId = 1;
  toast.dismiss();
  mockData = cloneFixture();

  // Compute expectedBalance dynamically in tests from latest BalanceCheck + subsequent out/in tx on that bank.
  vi.spyOn(domain, 'expectedBalance').mockImplementation((sourceId, data) => {
    const checks = data.balanceChecks
      .filter((c) => c.sourceId === sourceId)
      .sort((a, b) => b.checkedOn.localeCompare(a.checkedOn) || b.createdAt.localeCompare(a.createdAt));
    const latest = checks[0];
    if (!latest) return null;
    let bal = latest.actual;
    for (const tx of data.transactions) {
      if (tx.sourceId !== sourceId) continue;
      const after = tx.date > latest.checkedOn || (tx.date === latest.checkedOn && tx.createdAt > latest.createdAt);
      if (!after) continue;
      bal += tx.direction === 'in' ? tx.amount : -tx.amount;
    }
    return bal;
  });

  vi.spyOn(domain, 'forecast').mockImplementation((data, sourceId) => {
    const start = domain.expectedBalance(sourceId, data) ?? 0;
    return {
      ...DEFAULT_FORECAST,
      start,
    };
  });

  vi.spyOn(domain, 'hotbarItems').mockReturnValue([
    {
      note: 'ข้าวมันไก่',
      amount: 4_500,
      category: 'food',
      sourceId: 'src-bank',
      potId: 'pot-essential',
      count: 3,
      lastDate: '2026-11-08',
    } satisfies HotbarItem,
  ]);

  vi.spyOn(financeHooks, 'useFinanceData').mockImplementation(() => ({
    data: mockData,
    isLoading: false,
    error: null,
  }));

  createTxSpy.mockReset().mockImplementation(async (input) => {
    const created: Transaction = {
      id: `tx-plan-new-${nextId++}`,
      ...input,
      createdAt: input.createdAt ?? new Date(Date.UTC(2026, 10, 15, 12, nextId)).toISOString(),
      recurringIncomeId: input.recurringIncomeId ?? null,
      incomeDueOn: input.incomeDueOn ?? null,
    };
    setDataHook?.({ ...mockData, transactions: [created, ...mockData.transactions] });
    return created;
  });

  createBalanceCheckSpy.mockReset().mockImplementation(async (input) => {
    const checkedOn = input.checkedOn ?? TODAY;
    let adjustmentTx: Transaction | null = null;
    if (input.adjustment && input.adjustment.amount > 0) {
      adjustmentTx = {
        id: `tx-adj-${nextId++}`,
        date: checkedOn,
        amount: input.adjustment.amount,
        direction: input.adjustment.direction,
        sourceId: input.sourceId,
        potId: null,
        category: 'unknown',
        note: input.adjustment.note ?? 'ส่วนต่างเช็กยอด',
        createdAt: '2026-11-15T12:00:00.000Z',
        recurringIncomeId: null,
        incomeDueOn: null,
      };
    }
    const created: BalanceCheck = {
      id: `chk-new-${nextId++}`,
      sourceId: input.sourceId,
      checkedOn,
      actual: input.actual,
      expectedBefore: input.expectedBefore,
      adjustmentTxId: adjustmentTx ? adjustmentTx.id : null,
      createdAt: '2026-11-15T12:00:01.000Z',
    };
    setDataHook?.({
      ...mockData,
      transactions: adjustmentTx ? [adjustmentTx, ...mockData.transactions] : mockData.transactions,
      balanceChecks: [created, ...mockData.balanceChecks],
    });
    return created;
  });

  upsertPlanItemSpy.mockReset().mockImplementation(async (input) => {
    const existing = input.id ? mockData.planItems.find((p) => p.id === input.id) : undefined;
    const saved: PlanItem = {
      id: input.id ?? `plan-new-${nextId++}`,
      periodKey: input.periodKey,
      name: input.name,
      amount: input.amount,
      kind: input.kind,
      sourceId: input.sourceId,
      dueOn: input.dueOn,
      category: input.kind === 'save' ? 'savings' : input.category,
      doneTxId: input.doneTxId !== undefined ? input.doneTxId : (existing?.doneTxId ?? null),
      sortOrder: input.sortOrder ?? mockData.planItems.length + 1,
    };
    const exists = mockData.planItems.some((p) => p.id === saved.id);
    setDataHook?.({
      ...mockData,
      planItems: exists
        ? mockData.planItems.map((p) => (p.id === saved.id ? saved : p))
        : [...mockData.planItems, saved],
    });
    return saved;
  });

  deletePlanItemSpy.mockReset().mockImplementation(async (id) => {
    setDataHook?.({
      ...mockData,
      planItems: mockData.planItems.filter((p) => p.id !== id),
    });
  });

  completePlanItemSpy.mockReset().mockImplementation(async (id) => {
    const item = mockData.planItems.find((p) => p.id === id)!;
    const tx: Transaction = {
      id: `tx-done-${id}`,
      date: TODAY,
      amount: item.amount,
      direction: 'out',
      sourceId: item.sourceId,
      potId: null,
      category: item.kind === 'save' ? 'savings' : item.category,
      note: item.name,
      createdAt: '2026-11-15T12:00:00.000Z',
      recurringIncomeId: null,
      incomeDueOn: null,
    };
    const updated: PlanItem = { ...item, doneTxId: tx.id };
    setDataHook?.({
      ...mockData,
      transactions: [tx, ...mockData.transactions],
      planItems: mockData.planItems.map((p) => (p.id === id ? updated : p)),
    });
    return updated;
  });

  uncompletePlanItemSpy.mockReset().mockImplementation(async (id) => {
    const item = mockData.planItems.find((p) => p.id === id)!;
    const updated: PlanItem = { ...item, doneTxId: null };
    setDataHook?.({
      ...mockData,
      transactions: item.doneTxId ? mockData.transactions.filter((t) => t.id !== item.doneTxId) : mockData.transactions,
      planItems: mockData.planItems.map((p) => (p.id === id ? updated : p)),
    });
    return updated;
  });

  vi.spyOn(financeHooks, 'useCreateTransaction').mockImplementation(() => ({
    mutate: (input) => void createTxSpy(input),
    mutateAsync: createTxSpy,
    isPending: false,
    error: null,
  }));
  vi.spyOn(financeHooks, 'useCreateBalanceCheck').mockImplementation(() => ({
    mutate: (input) => void createBalanceCheckSpy(input),
    mutateAsync: createBalanceCheckSpy,
    isPending: false,
    error: null,
  }));
  vi.spyOn(financeHooks, 'useUpsertPlanItem').mockImplementation(() => ({
    mutate: (input) => void upsertPlanItemSpy(input),
    mutateAsync: upsertPlanItemSpy,
    isPending: false,
    error: null,
  }));
  vi.spyOn(financeHooks, 'useDeletePlanItem').mockImplementation(() => ({
    mutate: (id) => void deletePlanItemSpy(id),
    mutateAsync: deletePlanItemSpy,
    isPending: false,
    error: null,
  }));
  vi.spyOn(financeHooks, 'useCompletePlanItem').mockImplementation(() => ({
    mutate: (id) => void completePlanItemSpy(id),
    mutateAsync: completePlanItemSpy,
    isPending: false,
    error: null,
  }));
  vi.spyOn(financeHooks, 'useUncompletePlanItem').mockImplementation(() => ({
    mutate: (id) => void uncompletePlanItemSpy(id),
    mutateAsync: uncompletePlanItemSpy,
    isPending: false,
    error: null,
  }));
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setDataHook = null;
});

describe('<PlanPage>', () => {
  it('renders account card, C5 breakdown, timeline, plan items + auto bills, and check history', () => {
    render(<StatefulPlanHarness initial={cloneFixture()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'แผน' })).toBeTruthy();

    // Account card: 510,000 - (22,000 + 8,500 + 11,500) = 468,000 (฿4,680.00)
    const accountCard = screen.getByTestId('account-balance-card');
    expect(within(accountCard).getByText('ในแอปควรเหลือ')).toBeTruthy();
    expect(accountCard.textContent).toContain('฿4,680.00');
    expect(within(accountCard).getByText(/เช็กล่าสุด 5 วันก่อน/)).toBeTruthy();
    expect(within(accountCard).getByRole('button', { name: 'เช็กกับยอดจริง' })).toBeTruthy();

    // Available (C5) card
    const availableCard = screen.getByTestId('forecast-card');
    expect(within(availableCard).getByText('เงินในบัญชีตอนนี้ (ควรเหลือ)')).toBeTruthy();
    expect(within(availableCard).getByText('เงินประจำที่จะเข้า')).toBeTruthy();
    expect(within(availableCard).getByText('บิลที่ยังไม่จ่าย')).toBeTruthy();
    expect(within(availableCard).getByText('แผนที่ยังไม่ทำ')).toBeTruthy();
    // Pot leftovers are no longer part of the breakdown; this fixture still overspends (฿1,500.07 short) so the warning shows.
    expect(within(availableCard).queryByText('ที่เหลือในก้อน (รอบนี้)')).toBeNull();
    expect(within(availableCard).getByText(/แผนเกินเงินที่มี/)).toBeTruthy();

    // Timeline + low point
    const timeline = screen.getByTestId('forecast-timeline');
    expect(within(timeline).getByText(/จุดต่ำสุด/)).toBeTruthy();
    expect(within(timeline).getByText('ค่าหอ')).toBeTruthy();

    // Plan section: PlanItems + automatic bills with "บิล" badge
    const planSection = screen.getByTestId('plan-items-section');
    expect(within(planSection).getByText('ค่าหอ')).toBeTruthy();
    expect(within(planSection).getAllByText('เก็บ').length).toBeGreaterThanOrEqual(1);
    expect(within(planSection).getByText('บิล บัตรเครดิต')).toBeTruthy();
    expect(within(planSection).getByText('บิล SPayLater')).toBeTruthy();
    expect(within(planSection).getAllByText('บิล')).toHaveLength(2);

    // Check history
    const history = screen.getByTestId('balance-check-history');
    expect(within(history).getByText('ตั้งยอดเริ่มต้น')).toBeTruthy();
    expect(history.textContent).toContain('฿5,100.00');
  });

  it('shows "ตั้งยอดเริ่มต้น" when bank has no balance check and creates initial BalanceCheck for today', async () => {
    const initial = cloneFixture();
    initial.balanceChecks = [];
    render(<StatefulPlanHarness initial={initial} />);

    fireEvent.click(screen.getByRole('button', { name: 'ตั้งยอดเริ่มต้น' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'ตั้งยอดเริ่มต้น' })).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText('ยอดเงินในบัญชีตอนนี้'), { target: { value: '5100' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกยอดเริ่มต้น' }));

    await waitFor(() => expect(createBalanceCheckSpy).toHaveBeenCalledTimes(1));
    expect(createBalanceCheckSpy).toHaveBeenCalledWith({
      sourceId: 'src-bank',
      checkedOn: TODAY,
      actual: 510_000,
      expectedBefore: null,
      adjustment: null,
    });
    expect(await screen.findByText('ตั้งยอดเริ่มต้นแล้ว')).toBeTruthy();
  });

  it('handles balance check case 1: matched (< ฿1 diff) -> saves reference point without adjustment', async () => {
    render(<StatefulPlanHarness initial={cloneFixture()} />);

    fireEvent.click(screen.getByRole('button', { name: 'เช็กกับยอดจริง' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('ยอดจริงในบัญชี'), { target: { value: '4680.50' } });
    expect(within(dialog).getByText('ตรงกัน 👍')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกยอด' }));

    await waitFor(() => expect(createBalanceCheckSpy).toHaveBeenCalledTimes(1));
    expect(createBalanceCheckSpy).toHaveBeenCalledWith({
      sourceId: 'src-bank',
      checkedOn: TODAY,
      actual: 468_050,
      expectedBefore: 468_000,
      adjustment: null,
    });
  });

  it('handles balance check case 2: missing cash -> live diff updates on adding missed item, and saves adjustment as unknown', async () => {
    render(<StatefulPlanHarness initial={cloneFixture()} />);

    fireEvent.click(screen.getByRole('button', { name: 'เช็กกับยอดจริง' }));
    const dialog = screen.getByRole('dialog');

    // Expected is 4,680 -> actual 4,550 => missing ฿130.00
    fireEvent.change(within(dialog).getByLabelText('ยอดจริงในบัญชี'), { target: { value: '4550' } });
    expect(within(dialog).getByText(/หายไป/)).toBeTruthy();
    expect(dialog.textContent).toContain('฿130.00');

    // 5 recent bank transactions shown for comparison
    expect(within(dialog).getByText('เกม')).toBeTruthy();
    expect(within(dialog).getByText('หนัง')).toBeTruthy();

    // Add a missed expense of ฿45 via quick hotbar chip -> expected becomes 4,635, diff shrinks to ฿85.00
    fireEvent.click(within(dialog).getByRole('button', { name: /ข้าวมันไก่/ }));
    await waitFor(() => expect(createTxSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(dialog.textContent).toContain('฿85.00'));

    // Save remaining diff as "ลืมจด"
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกส่วนต่างเป็น ลืมจด' }));
    await waitFor(() => expect(createBalanceCheckSpy).toHaveBeenCalledTimes(1));
    expect(createBalanceCheckSpy).toHaveBeenCalledWith({
      sourceId: 'src-bank',
      checkedOn: TODAY,
      actual: 455_000,
      expectedBefore: 463_500,
      adjustment: { amount: 8_500, direction: 'out', note: 'ส่วนต่างเช็กยอด' },
    });
  });

  it('handles balance check case 3: surplus cash -> records income live or saves balance only', async () => {
    render(<StatefulPlanHarness initial={cloneFixture()} />);

    fireEvent.click(screen.getByRole('button', { name: 'เช็กกับยอดจริง' }));
    const dialog = screen.getByRole('dialog');

    // Expected is 4,680 -> actual 4,880 => surplus ฿200.00
    fireEvent.change(within(dialog).getByLabelText('ยอดจริงในบัญชี'), { target: { value: '4880' } });
    expect(within(dialog).getByText(/เกินมา/)).toBeTruthy();
    expect(dialog.textContent).toContain('฿200.00');

    // Record missing income ฿150 -> diff shrinks to ฿50.00
    fireEvent.click(within(dialog).getByRole('button', { name: 'จดเงินเข้า' }));
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงินเข้า'), { target: { value: '150' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึกเงินเข้า' }));

    await waitFor(() => expect(createTxSpy).toHaveBeenCalledTimes(1));
    expect(createTxSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'in',
        amount: 15_000,
        sourceId: 'src-bank',
      }),
    );
    await waitFor(() => expect(dialog.textContent).toContain('฿50.00'));

    // Choose "แค่บันทึกยอด" -> saves without creating adjustment tx
    fireEvent.click(within(dialog).getByRole('button', { name: 'แค่บันทึกยอด' }));
    await waitFor(() => expect(createBalanceCheckSpy).toHaveBeenCalledWith({
      sourceId: 'src-bank',
      checkedOn: TODAY,
      actual: 488_000,
      expectedBefore: 483_000,
      adjustment: null,
    }));
  });

  it('adds, warns on duplicate bill name, completes/uncompletes, deletes, and copies previous period plan items', async () => {
    const initial = cloneFixture();
    initial.planItems.push({
      id: 'plan-prev-1',
      periodKey: '2026-10',
      name: 'ค่าเน็ตบ้าน',
      amount: 59_000,
      kind: 'pay',
      sourceId: 'src-bank',
      dueOn: '2026-10-20',
      category: 'bills',
      doneTxId: 'tx-old',
      sortOrder: 1,
    });
    render(<StatefulPlanHarness initial={initial} />);

    const planSection = screen.getByTestId('plan-items-section');

    // Complete & uncomplete PlanItem
    fireEvent.click(within(planSection).getByRole('button', { name: 'จ่ายแล้ว' }));
    await waitFor(() => expect(completePlanItemSpy).toHaveBeenCalledWith('plan-dorm'));
    expect(await screen.findByText('บันทึกแล้ว')).toBeTruthy();

    fireEvent.click(within(planSection).getByRole('button', { name: 'ยกเลิก' }));
    await waitFor(() => expect(uncompletePlanItemSpy).toHaveBeenCalledWith('plan-dorm'));
    expect(await screen.findByText('ยกเลิกแล้ว')).toBeTruthy();

    // Complete save item -> "เก็บแล้ว"
    fireEvent.click(within(planSection).getByRole('button', { name: 'เก็บแล้ว' }));
    await waitFor(() => expect(completePlanItemSpy).toHaveBeenCalledWith('plan-save'));

    // Add PlanItem with duplicate bill warning
    fireEvent.click(within(planSection).getByRole('button', { name: 'เพิ่มแผน' }));
    const addDialog = screen.getByRole('dialog');
    fireEvent.change(within(addDialog).getByLabelText('ชื่อรายการ'), { target: { value: 'บัตรเครดิต' } });
    expect(within(addDialog).getByText(/คล้ายกับบิลอัตโนมัติ/)).toBeTruthy();

    fireEvent.change(within(addDialog).getByLabelText('ชื่อรายการ'), { target: { value: 'ประกัน' } });
    fireEvent.change(within(addDialog).getByLabelText('จำนวนเงิน'), { target: { value: '1200' } });
    // Bank sources only in select
    const srcSelect = within(addDialog).getByLabelText('จากบัญชี') as HTMLSelectElement;
    expect(Array.from(srcSelect.options).map((o) => o.textContent)).toEqual(['บัญชี']);

    fireEvent.click(within(addDialog).getByRole('button', { name: 'บันทึก' }));
    await waitFor(() => expect(upsertPlanItemSpy).toHaveBeenCalled());
    await waitFor(() => expect(within(planSection).getByText('ประกัน').closest('.row-enter')).toBeTruthy());

    // Copy previous period
    fireEvent.click(within(planSection).getByRole('button', { name: 'ใช้แผนรอบก่อน' }));
    await waitFor(() => expect(within(planSection).getByText('ค่าเน็ตบ้าน')).toBeTruthy());
    expect(await screen.findByText('คัดลอกแผนรอบก่อนแล้ว')).toBeTruthy();

    // Edit & HoldToDelete
    fireEvent.click(within(planSection).getByText('ประกัน'));
    const editDialog = screen.getByRole('dialog');
    const holdBtn = within(editDialog).getByRole('button', { name: 'กดค้างเพื่อลบ' });
    vi.useFakeTimers();
    fireEvent.pointerDown(holdBtn);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    vi.useRealTimers();

    await waitFor(() => expect(deletePlanItemSpy).toHaveBeenCalled());
    await waitFor(() => expect(within(planSection).queryByText('ประกัน')).toBeNull(), {
      timeout: ROW_EXIT_MS + 1000,
    });
  });

  it('shows negative timeline warning and error toast on mutation failure', async () => {
    vi.spyOn(domain, 'forecast').mockReturnValue({
      ...DEFAULT_FORECAST,
      low: { date: '2026-11-24', balance: -12_000 },
    });
    completePlanItemSpy.mockRejectedValueOnce(new Error('บันทึกล้มเหลว'));

    render(<StatefulPlanHarness initial={cloneFixture()} />);

    expect(screen.getByText(/เงินไม่พอวันที่ 24 พ\.ย\./)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'จ่ายแล้ว' }));
    const err = await screen.findByText(/บันทึกล้มเหลว/);
    expect(err.closest('[data-sonner-toast]')?.getAttribute('data-type')).toBe('error');
  });

  it('renders single-column mobile layout at 375px and 2-column desktop layout at 1280px', () => {
    mockMatchMedia(375);
    const { unmount } = render(<StatefulPlanHarness initial={cloneFixture()} withShell />);

    const layout375 = screen.getByTestId('plan-layout');
    expect(layout375.className).toContain('flex-col');
    expect(layout375.className).toContain('lg:grid');

    fireEvent.click(screen.getByRole('button', { name: 'เช็กกับยอดจริง' }));
    expect(screen.getByRole('dialog').getAttribute('data-vaul-drawer-direction')).toBe('bottom');
    unmount();

    mockMatchMedia(1280);
    render(<StatefulPlanHarness initial={cloneFixture()} withShell />);
    const left = screen.getByTestId('plan-left');
    const right = screen.getByTestId('plan-right');
    expect(within(left).getByTestId('account-balance-card')).toBeTruthy();
    expect(within(left).getByTestId('forecast-card')).toBeTruthy();
    expect(within(right).getByTestId('plan-items-section')).toBeTruthy();
    expect(within(right).getByTestId('forecast-timeline')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'เช็กกับยอดจริง' }));
    expect(screen.getByRole('dialog').getAttribute('data-vaul-drawer-direction')).toBe('right');
  });

  it('shows bank account selector when more than one active bank exists and switches active account', () => {
    const initial = cloneFixture();
    initial.sources.push({
      id: 'src-bank-2',
      name: 'กสิกร',
      kind: 'bank',
      hue: 'teal',
      archived: false,
      statementCloseDay: null,
      dueDay: null,
      dueMonthOffset: null,
      payFromSourceId: null,
    });
    initial.balanceChecks.push({
      id: 'chk-kbank',
      sourceId: 'src-bank-2',
      checkedOn: TODAY,
      actual: 900_000,
      expectedBefore: null,
      adjustmentTxId: null,
      createdAt: '2026-11-15T08:00:00.000Z',
    });

    render(<StatefulPlanHarness initial={initial} />);

    const selector = screen.getByRole('tablist', { name: 'เลือกบัญชี' });
    expect(within(selector).getByRole('tab', { name: 'บัญชี' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(within(selector).getByRole('tab', { name: 'กสิกร' }));
    expect(screen.getByTestId('account-balance-card').textContent).toContain('฿9,000.00');
  });

  it('supports swipe-to-delete on PlanItem rows with undo toast', async () => {
    class JsdomPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 1;
        this.pointerType = params.pointerType ?? '';
      }
    }
    vi.stubGlobal('PointerEvent', JsdomPointerEvent);

    render(<StatefulPlanHarness initial={cloneFixture()} />);
    const planSection = screen.getByTestId('plan-items-section');
    const dormTrack = within(planSection).getByText('ค่าหอ').closest('[data-testid="swipe-track"]') as HTMLElement;

    fireEvent.pointerDown(dormTrack, { pointerId: 1, clientX: 300, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerMove(dormTrack, { pointerId: 1, clientX: 80, clientY: 20, pointerType: 'touch' });
    fireEvent.pointerUp(dormTrack, { pointerId: 1, clientX: 80, clientY: 20, pointerType: 'touch' });

    await waitFor(() => expect(deletePlanItemSpy).toHaveBeenCalledWith('plan-dorm'));
    const toastMsg = await screen.findByText('ลบค่าหอแล้ว');
    const toastEl = toastMsg.closest('li') ?? toastMsg.parentElement!.parentElement!;
    fireEvent.click(within(toastEl).getByRole('button', { name: 'เลิกทำ' }));

    await waitFor(() => expect(upsertPlanItemSpy).toHaveBeenCalled());
    expect(await within(planSection).findByText('ค่าหอ')).toBeTruthy();
  });
});
