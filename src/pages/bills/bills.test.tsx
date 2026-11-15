import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { AppToaster } from '../../components/ui/Toaster';
import { financeFixture } from '../../fixtures/finance';
import type {
  BillPayment,
  FinanceData,
  ISODate,
  Installment,
  InstallmentCharge,
  PayBillInput,
  PayPeriod,
  PaymentSource,
  PeriodKey,
  Pot,
  PotStatus,
  StatementWindow,
  Subscription,
  SubscriptionCharge,
  UpsertInstallmentInput,
  UpsertSubscriptionInput,
} from '../../types/finance';
import BillsPage from './index';

vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

// ---- Spec-compliant domain mock (src/domain is a stub until prompt 02 merges) -------------------------------------

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseIso(iso: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate();
}

function formatIso(y: number, m1: number, d: number): ISODate {
  return `${y}-${pad2(m1)}-${pad2(d)}`;
}

function addMonths(y: number, m1: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m1 - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

function addDaysIso(iso: ISODate, delta: number): ISODate {
  const { y, m, d } = parseIso(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return formatIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function clampDate(y: number, m1: number, day: number): ISODate {
  return formatIso(y, m1, Math.min(day, daysInMonth(y, m1)));
}

function mockPayPeriod(date: ISODate, payDay: number): PayPeriod {
  const { y, m, d } = parseIso(date);
  const startMonth = d >= payDay ? { y, m } : addMonths(y, m, -1);
  const nextMonth = addMonths(startMonth.y, startMonth.m, 1);
  const start = clampDate(startMonth.y, startMonth.m, payDay);
  const nextStart = clampDate(nextMonth.y, nextMonth.m, payDay);
  return {
    key: `${startMonth.y}-${pad2(startMonth.m)}`,
    start,
    end: addDaysIso(nextStart, -1),
  };
}

function mockStatementFor(src: PaymentSource, chargeDate: ISODate): StatementWindow {
  const { y, m, d } = parseIso(chargeDate);
  if (src.statementCloseDay === null) {
    const start = formatIso(y, m, 1);
    const end = formatIso(y, m, daysInMonth(y, m));
    const dueYM = addMonths(y, m, src.dueMonthOffset ?? 1);
    const dueDate = clampDate(dueYM.y, dueYM.m, src.dueDay ?? 10);
    return { key: `${y}-${pad2(m)}`, start, end, dueDate };
  }
  const closeYM = d >= src.statementCloseDay ? addMonths(y, m, 1) : { y, m };
  const startYM = addMonths(closeYM.y, closeYM.m, -1);
  const start = clampDate(startYM.y, startYM.m, src.statementCloseDay);
  const closeDate = clampDate(closeYM.y, closeYM.m, src.statementCloseDay);
  const end = addDaysIso(closeDate, -1);
  const dueYM = addMonths(closeYM.y, closeYM.m, src.dueMonthOffset ?? 0);
  const dueDate = clampDate(dueYM.y, dueYM.m, src.dueDay ?? src.statementCloseDay);
  return { key: `${closeYM.y}-${pad2(closeYM.m)}`, start, end, dueDate };
}

function mockSubscriptionCharges(sub: Subscription, from: ISODate, to: ISODate): SubscriptionCharge[] {
  if (!sub.active) return [];
  const start = parseIso(from);
  const end = parseIso(to);
  const out: SubscriptionCharge[] = [];
  let cur = { y: start.y, m: start.m };
  while (cur.y < end.y || (cur.y === end.y && cur.m <= end.m)) {
    if (sub.frequency === 'monthly' || cur.m === sub.billingMonth) {
      const date = clampDate(cur.y, cur.m, sub.billingDay);
      if (date >= from && date <= to) out.push({ date, amount: sub.amount });
    }
    cur = addMonths(cur.y, cur.m, 1);
  }
  return out;
}

function mockInstallmentSchedule(inst: Installment): InstallmentCharge[] {
  const { y, m, d } = parseIso(inst.firstChargeDate);
  return Array.from({ length: inst.count }, (_, idx) => {
    const ym = addMonths(y, m, idx);
    return {
      n: idx + 1,
      chargeDate: clampDate(ym.y, ym.m, d),
      amount: inst.perInstallment,
    };
  });
}

function mockBillAmount(src: PaymentSource, statementKey: PeriodKey, data: FinanceData): number {
  const [ky, km] = statementKey.split('-').map(Number);
  const probe = src.statementCloseDay === null ? formatIso(ky, km, 1) : formatIso(ky, km, 1);
  const win = mockStatementFor(src, probe);
  let total = 0;
  for (const tx of data.transactions) {
    if (tx.sourceId === src.id && tx.direction === 'out' && tx.date >= win.start && tx.date <= win.end) {
      total += tx.amount;
    }
  }
  for (const sub of data.subscriptions) {
    if (sub.sourceId === src.id && sub.active) {
      for (const c of mockSubscriptionCharges(sub, win.start, win.end)) total += c.amount;
    }
  }
  for (const inst of data.installments) {
    if (inst.sourceId === src.id) {
      for (const c of mockInstallmentSchedule(inst)) {
        if (c.chargeDate >= win.start && c.chargeDate <= win.end) total += c.amount;
      }
    }
  }
  return total;
}

function mockPotStatus(pot: Pot, periodKey: PeriodKey, data: FinanceData): PotStatus {
  // Compute period window and charges attributed to `pot` matching SPEC §4.
  const [py, pm] = periodKey.split('-').map(Number);
  const period = mockPayPeriod(formatIso(py, pm, data.settings.payDay), data.settings.payDay);
  const carryIn = pot.rollover && periodKey === '2026-11' ? 54_100 : 0;
  const budget = pot.perPeriod + carryIn;

  let reserved = 0;
  let spent = 0;

  for (const tx of data.transactions) {
    if (tx.potId !== pot.id || tx.direction !== 'out') continue;
    const src = data.sources.find((s) => s.id === tx.sourceId);
    if (src && src.kind === 'bank' && tx.date >= period.start && tx.date <= period.end) {
      spent += tx.amount;
    }
  }

  for (const src of data.sources) {
    if (src.kind === 'bank') continue;
    // Check statement windows that could fall due in this pay period.
    for (let offset = -1; offset <= 2; offset++) {
      const probeYM = addMonths(py, pm, offset);
      const win = mockStatementFor(src, formatIso(probeYM.y, probeYM.m, 1));
      const billPeriod = mockPayPeriod(addDaysIso(win.dueDate, -1), data.settings.payDay);
      if (billPeriod.key !== periodKey) continue;

      let potBill = 0;
      for (const sub of data.subscriptions) {
        if (sub.sourceId === src.id && sub.potId === pot.id && sub.active) {
          for (const c of mockSubscriptionCharges(sub, win.start, win.end)) potBill += c.amount;
        }
      }
      for (const inst of data.installments) {
        if (inst.sourceId === src.id && inst.potId === pot.id) {
          for (const c of mockInstallmentSchedule(inst)) {
            if (c.chargeDate >= win.start && c.chargeDate <= win.end) potBill += c.amount;
          }
        }
      }
      if (potBill === 0) continue;
      const paid = data.payments.some((p) => p.sourceId === src.id && p.statementKey === win.key);
      if (paid) spent += potBill;
      else reserved += potBill;
    }
  }

  const left = budget - reserved - spent;
  return { carryIn, budget, reserved, spent, left, over: left < 0 };
}

vi.mock('../../domain', () => ({
  payPeriod: (date: ISODate, payDay: number) => mockPayPeriod(date, payDay),
  statementFor: (src: PaymentSource, chargeDate: ISODate) => mockStatementFor(src, chargeDate),
  subscriptionCharges: (sub: Subscription, from: ISODate, to: ISODate) => mockSubscriptionCharges(sub, from, to),
  installmentSchedule: (inst: Installment) => mockInstallmentSchedule(inst),
  billAmount: (src: PaymentSource, statementKey: PeriodKey, data: FinanceData) =>
    mockBillAmount(src, statementKey, data),
  upcomingOutflows: () => [],
  potStatus: (pot: Pot, periodKey: PeriodKey, data: FinanceData) => mockPotStatus(pot, periodKey, data),
}));

// ---- Controllable finance hooks mock ----------------------------------------------------------------------------

let mockData: FinanceData | undefined = financeFixture;
let mockLoading = false;
let mockError: Error | null = null;

const payBillSpy = vi.fn<(input: PayBillInput) => Promise<BillPayment>>();
const upsertInstallmentSpy = vi.fn<(input: UpsertInstallmentInput) => Promise<Installment>>();
const deleteInstallmentSpy = vi.fn<(id: string) => Promise<void>>();
const upsertSubscriptionSpy = vi.fn<(input: UpsertSubscriptionInput) => Promise<Subscription>>();
const deleteSubscriptionSpy = vi.fn<(id: string) => Promise<void>>();

vi.mock('../../hooks/useFinance', () => ({
  useFinanceData: () => ({ data: mockData, isLoading: mockLoading, error: mockError }),
  usePayBill: () => ({
    mutate: (input: PayBillInput) => {
      void payBillSpy(input);
    },
    mutateAsync: payBillSpy,
    isPending: false,
    error: null,
  }),
  useUpsertInstallment: () => ({
    mutate: (input: UpsertInstallmentInput) => {
      void upsertInstallmentSpy(input);
    },
    mutateAsync: upsertInstallmentSpy,
    isPending: false,
    error: null,
  }),
  useDeleteInstallment: () => ({
    mutate: (id: string) => {
      void deleteInstallmentSpy(id);
    },
    mutateAsync: deleteInstallmentSpy,
    isPending: false,
    error: null,
  }),
  useUpsertSubscription: () => ({
    mutate: (input: UpsertSubscriptionInput) => {
      void upsertSubscriptionSpy(input);
    },
    mutateAsync: upsertSubscriptionSpy,
    isPending: false,
    error: null,
  }),
  useDeleteSubscription: () => ({
    mutate: (id: string) => {
      void deleteSubscriptionSpy(id);
    },
    mutateAsync: deleteSubscriptionSpy,
    isPending: false,
    error: null,
  }),
}));

beforeEach(() => {
  // jsdom omits Pointer Events capture APIs that Vaul invokes on Drawer.Content pointerdown.
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  mockData = structuredClone(financeFixture);
  mockLoading = false;
  mockError = null;
  payBillSpy.mockReset().mockImplementation(async (input) => ({ id: 'pay-new', ...input }));
  upsertInstallmentSpy
    .mockReset()
    .mockImplementation(async (input) => ({ id: input.id ?? 'inst-new', ...input }));
  deleteInstallmentSpy.mockReset().mockResolvedValue(undefined);
  upsertSubscriptionSpy
    .mockReset()
    .mockImplementation(async (input) => ({ id: input.id ?? 'sub-new', ...input }));
  deleteSubscriptionSpy.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  toast.dismiss();
  vi.useRealTimers();
});

function renderPage(today: ISODate = '2026-11-15') {
  return render(
    <>
      <BillsPage today={today} />
      <AppToaster />
    </>,
  );
}

describe('<BillsPage>', () => {
  it('renders heading "บิล & ผ่อน" and SegmentedControl with บิล / ผ่อน / สมาชิก', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'บิล & ผ่อน' })).toBeTruthy();
    const tablist = screen.getByRole('tablist');
    expect(within(tablist).getByRole('tab', { name: 'บิล' })).toBeTruthy();
    expect(within(tablist).getByRole('tab', { name: 'ผ่อน' })).toBeTruthy();
    expect(within(tablist).getByRole('tab', { name: 'สมาชิก' })).toBeTruthy();
  });

  describe('แท็บบิล', () => {
    it('shows card and SPayLater bills with hue, current billAmount, DateBadge (dueBy for SPayLater), status, and charges', () => {
      renderPage('2026-11-15');
      const cardSection = screen.getByTestId('bill-card-src-card');
      expect(cardSection.innerHTML).toContain('bg-sky-bg');
      expect(within(cardSection).getByText('บัตรเครดิต')).toBeTruthy();
      expect(within(cardSection).getByText('฿1,077')).toBeTruthy();
      expect(within(cardSection).getByText('24')).toBeTruthy();
      expect(within(cardSection).getAllByText('พ.ย.').length).toBeGreaterThanOrEqual(1);
      expect(within(cardSection).getByText('ยังไม่จ่าย')).toBeTruthy();
      expect(within(cardSection).getByText('Claude')).toBeTruthy();
      expect(within(cardSection).getByText('Gemini + YouTube')).toBeTruthy();
      expect(within(cardSection).getByText('iCloud')).toBeTruthy();

      const spaySection = screen.getByTestId('bill-card-src-spay');
      expect(spaySection.innerHTML).toContain('bg-apricot-bg');
      expect(within(spaySection).getByText('SPayLater')).toBeTruthy();
      expect(within(spaySection).getAllByText('฿1,381').length).toBeGreaterThanOrEqual(1);
      expect(within(spaySection).getByText('≤10')).toBeTruthy();
      expect(within(spaySection).getByText('ธ.ค.')).toBeTruthy();
      expect(within(spaySection).getByText('AirPods งวด 3/10')).toBeTruthy();
    });

    it('calls usePayBill when clicking "จ่ายแล้ว" and shows toast', async () => {
      renderPage('2026-11-15');
      const cardSection = screen.getByTestId('bill-card-src-card');
      fireEvent.click(within(cardSection).getByRole('button', { name: /จ่ายแล้ว/ }));
      await waitFor(() =>
        expect(payBillSpy).toHaveBeenCalledWith({
          sourceId: 'src-card',
          statementKey: '2026-11',
          amount: 107_700,
          paidOn: '2026-11-15',
        }),
      );
      expect(await screen.findByText('บันทึกจ่ายบิลแล้ว')).toBeTruthy();
    });

    it('shows collapsible history of the 3 previous cycles', () => {
      renderPage('2026-11-15');
      const cardSection = screen.getByTestId('bill-card-src-card');
      const toggle = within(cardSection).getByRole('button', { name: /ประวัติ 3 รอบก่อน/ });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(within(cardSection).queryByTestId('bill-history-src-card')).toBeNull();

      fireEvent.click(toggle);
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      const history = within(cardSection).getByTestId('bill-history-src-card');
      expect(within(history).getAllByTestId('history-cycle-row')).toHaveLength(3);
      // 2026-10 is marked paid in financeFixture.
      expect(within(history).getByText('จ่ายแล้ว')).toBeTruthy();
    });
  });

  describe('แท็บผ่อน', () => {
    it('shows AirPods installment as งวด 3/10 on 2026-11-15 with remaining total, end date, channel pill, and play-pot badge', () => {
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));

      const row = screen.getByTestId('installment-item-inst-airpods');
      expect(within(row).getByText('AirPods')).toBeTruthy();
      expect(within(row).getByText('งวด 3/10')).toBeTruthy();
      expect(within(row).getByText('฿1,381')).toBeTruthy();
      // 7 installments remaining: 7 * 1381.93 = 9,673.51
      expect(within(row).getByText('฿9,673')).toBeTruthy();
      expect(within(row).getByText('1 มิ.ย. 2570')).toBeTruthy();
      expect(within(row).getByText('SPayLater')).toBeTruthy();
      expect(within(row).getByText('นับในใช้ตามใจ')).toBeTruthy();
    });

    it('shows "แยก" badge when installment potId is null', () => {
      mockData!.installments.push({
        id: 'inst-sep',
        name: 'MacBook',
        perInstallment: 250_000,
        count: 6,
        firstChargeDate: '2026-11-01',
        sourceId: 'src-card',
        potId: null,
      });
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      const row = screen.getByTestId('installment-item-inst-sep');
      expect(within(row).getByText('แยก')).toBeTruthy();
      expect(within(row).getByText('งวด 1/6')).toBeTruthy();
    });

    it('maps "นับรวมในวงเงินใช้ตามใจ" switch to potId ("pot-play" when on, null when off)', async () => {
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการผ่อน' }));

      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('ชื่อรายการ'), { target: { value: 'iPad' } });
      fireEvent.change(within(dialog).getByLabelText('ยอดต่องวด'), { target: { value: '500' } });
      fireEvent.change(within(dialog).getByLabelText('จำนวนงวด'), { target: { value: '3' } });
      fireEvent.change(within(dialog).getByLabelText('วันที่งวดแรก'), { target: { value: '2026-12-01' } });
      // Default switch is ON -> pot-play; toggle OFF -> null.
      const sw = within(dialog).getByRole('switch', { name: 'นับรวมในวงเงินใช้ตามใจ' });
      expect(sw.getAttribute('aria-checked')).toBe('true');
      fireEvent.click(sw);
      expect(sw.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
      await waitFor(() =>
        expect(upsertInstallmentSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'iPad',
            perInstallment: 50_000,
            count: 3,
            firstChargeDate: '2026-12-01',
            potId: null,
          }),
        ),
      );

      // Toast with undo calls deleteInstallment on new record.
      const undoBtn = await screen.findByRole('button', { name: 'เลิกทำ' });
      fireEvent.click(undoBtn);
      await waitFor(() => expect(deleteInstallmentSpy).toHaveBeenCalledWith('inst-new'));
    });

    it('maps switch ON to pot-play when adding an installment', async () => {
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการผ่อน' }));

      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('ชื่อรายการ'), { target: { value: 'หูฟัง' } });
      fireEvent.change(within(dialog).getByLabelText('ยอดต่องวด'), { target: { value: '300' } });
      fireEvent.change(within(dialog).getByLabelText('จำนวนงวด'), { target: { value: '4' } });
      fireEvent.change(within(dialog).getByLabelText('วันที่งวดแรก'), { target: { value: '2026-11-05' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

      await waitFor(() =>
        expect(upsertInstallmentSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'หูฟัง',
            potId: 'pot-play',
          }),
        ),
      );
    });

    it('shows over-budget warning before saving when simulated potStatus is over, and clears it when switch is off', () => {
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการผ่อน' }));

      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('ชื่อรายการ'), { target: { value: 'กล้อง' } });
      // Remaining play pot in 2026-11 is ฿662.07; adding ฿1,000 causes over-budget!
      fireEvent.change(within(dialog).getByLabelText('ยอดต่องวด'), { target: { value: '1000' } });
      fireEvent.change(within(dialog).getByLabelText('จำนวนงวด'), { target: { value: '3' } });
      fireEvent.change(within(dialog).getByLabelText('วันที่งวดแรก'), { target: { value: '2026-11-01' } });

      const alert = within(dialog).getByRole('alert');
      expect(alert.textContent).toContain('เกินงบ');

      // Turning switch OFF excludes from play pot -> warning disappears.
      fireEvent.click(within(dialog).getByRole('switch', { name: 'นับรวมในวงเงินใช้ตามใจ' }));
      expect(within(dialog).queryByRole('alert')).toBeNull();
    });

    it('shows Thai validation errors linked via aria-describedby', () => {
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการผ่อน' }));

      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

      const nameInput = within(dialog).getByLabelText('ชื่อรายการ');
      const nameErrId = nameInput.getAttribute('aria-describedby');
      expect(nameErrId).toBeTruthy();
      expect(document.getElementById(nameErrId!)!.textContent).toContain('กรุณากรอก');

      const amountInput = within(dialog).getByLabelText('ยอดต่องวด');
      const amountErrId = amountInput.getAttribute('aria-describedby');
      expect(amountErrId).toBeTruthy();
      expect(document.getElementById(amountErrId!)!.textContent).toContain('0');

      expect(upsertInstallmentSpy).not.toHaveBeenCalled();
    });

    it('requires holding HoldToDelete for 1200ms to delete an existing installment, then offers undo toast', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      fireEvent.click(screen.getByTestId('installment-item-inst-airpods'));

      const dialog = screen.getByRole('dialog');
      const holdBtn = within(dialog).getByRole('button', { name: /กดค้างเพื่อลบ/ });

      // Short press (600ms) must not delete.
      fireEvent.pointerDown(holdBtn);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      fireEvent.pointerUp(holdBtn);
      expect(deleteInstallmentSpy).not.toHaveBeenCalled();

      // Full 1200ms hold deletes.
      fireEvent.pointerDown(holdBtn);
      await act(async () => {
        vi.advanceTimersByTime(1200);
      });
      expect(deleteInstallmentSpy).toHaveBeenCalledWith('inst-airpods');

      // Flush Sonner's mount timer before restoring real timers.
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
      vi.useRealTimers();
      const undoBtn = await screen.findByRole('button', { name: 'เลิกทำ' });
      fireEvent.click(undoBtn);
      await waitFor(() =>
        expect(upsertInstallmentSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'inst-airpods', name: 'AirPods' })),
      );
    });
  });

  describe('แท็บสมาชิก', () => {
    it('sorts subscriptions by monthly amount descending, shows yearly as monthly+yearly, and shows monthly total + % of salary', () => {
      mockData!.subscriptions.push({
        id: 'sub-yearly',
        name: 'Domain',
        amount: 120_000, // ฿1,200/year = ฿100/month
        frequency: 'yearly',
        billingDay: 15,
        billingMonth: 6,
        sourceId: 'src-card',
        potId: 'pot-play',
        active: true,
      });

      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'สมาชิก' }));

      // Total monthly: 699 + 279 + 99 + 100 = 1,177.00; 1177 / 10200 = 11.5%
      const summary = screen.getByTestId('subscriptions-summary');
      expect(within(summary).getByText('฿1,177')).toBeTruthy();
      expect(within(summary).getByText(/11\.5%/)).toBeTruthy();

      // Order by monthly desc: Claude (699) > Gemini + YouTube (279) > Domain (100/mo) > iCloud (99)
      const rows = screen.getAllByTestId(/^subscription-item-/);
      expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
        'subscription-item-sub-claude',
        'subscription-item-sub-gemini',
        'subscription-item-sub-yearly',
        'subscription-item-sub-icloud',
      ]);

      const yearlyRow = screen.getByTestId('subscription-item-sub-yearly');
      expect(within(yearlyRow).getByText('฿100')).toBeTruthy();
      expect(within(yearlyRow).getByText(/฿1,200\.00\/ปี/)).toBeTruthy();
    });

    it('adds and validates subscription with yearly month selector and undo toast', async () => {
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'สมาชิก' }));
      fireEvent.click(screen.getByRole('button', { name: 'เพิ่มสมาชิก' }));

      const dialog = screen.getByRole('dialog');
      // Validation before filling.
      fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
      const nameInput = within(dialog).getByLabelText('ชื่อสมาชิก');
      const errId = nameInput.getAttribute('aria-describedby');
      expect(errId).toBeTruthy();
      expect(document.getElementById(errId!)!.textContent).toContain('กรุณากรอก');

      // Monthly hides month select; switching to yearly reveals it.
      expect(within(dialog).queryByLabelText('เดือนที่ตัดเงิน')).toBeNull();
      fireEvent.click(within(dialog).getByRole('tab', { name: 'รายปี' }));
      expect(within(dialog).getByLabelText('เดือนที่ตัดเงิน')).toBeTruthy();

      fireEvent.change(nameInput, { target: { value: '1Password' } });
      fireEvent.change(within(dialog).getByLabelText('ยอดเงิน'), { target: { value: '1200' } });
      fireEvent.change(within(dialog).getByLabelText('วันตัดเงิน (1–31)'), { target: { value: '18' } });
      fireEvent.change(within(dialog).getByLabelText('เดือนที่ตัดเงิน'), { target: { value: '5' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

      await waitFor(() =>
        expect(upsertSubscriptionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            name: '1Password',
            amount: 120_000,
            frequency: 'yearly',
            billingDay: 18,
            billingMonth: 5,
            active: true,
          }),
        ),
      );

      const undoBtn = await screen.findByRole('button', { name: 'เลิกทำ' });
      fireEvent.click(undoBtn);
      await waitFor(() => expect(deleteSubscriptionSpy).toHaveBeenCalledWith('sub-new'));
    });

    it('requires HoldToDelete for 1200ms to delete an existing subscription and offers undo toast', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'สมาชิก' }));
      fireEvent.click(screen.getByTestId('subscription-item-sub-claude'));

      const dialog = screen.getByRole('dialog');
      const holdBtn = within(dialog).getByRole('button', { name: /กดค้างเพื่อลบ/ });
      fireEvent.pointerDown(holdBtn);
      act(() => {
        vi.advanceTimersByTime(1199);
      });
      expect(deleteSubscriptionSpy).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(deleteSubscriptionSpy).toHaveBeenCalledWith('sub-claude');

      await act(async () => {
        vi.advanceTimersByTime(50);
      });
      vi.useRealTimers();
      const undoBtn = await screen.findByRole('button', { name: 'เลิกทำ' });
      fireEvent.click(undoBtn);
      await waitFor(() =>
        expect(upsertSubscriptionSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'sub-claude', name: 'Claude' })),
      );
    });

    it('rejects out-of-range billingDay with aria-describedby error', () => {
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'สมาชิก' }));
      fireEvent.click(screen.getByRole('button', { name: 'เพิ่มสมาชิก' }));

      const dialog = screen.getByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('ชื่อสมาชิก'), { target: { value: 'Netflix' } });
      fireEvent.change(within(dialog).getByLabelText('ยอดเงิน'), { target: { value: '419' } });
      const dayInput = within(dialog).getByLabelText('วันตัดเงิน (1–31)');
      fireEvent.change(dayInput, { target: { value: '32' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

      const errId = dayInput.getAttribute('aria-describedby');
      expect(errId).toBeTruthy();
      expect(document.getElementById(errId!)!.textContent).toContain('1 ถึง 31');
      expect(upsertSubscriptionSpy).not.toHaveBeenCalled();
    });
  });

  describe('loading and error states', () => {
    it('renders heading and skeleton while loading', () => {
      mockLoading = true;
      mockData = undefined;
      renderPage('2026-11-15');
      expect(screen.getByRole('heading', { level: 1, name: 'บิล & ผ่อน' })).toBeTruthy();
      expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    });

    it('renders empty error message when loading fails', () => {
      mockError = new Error('network');
      mockData = undefined;
      renderPage('2026-11-15');
      expect(screen.getByText(/โหลดข้อมูลบิลไม่สำเร็จ/)).toBeTruthy();
    });
  });
});
