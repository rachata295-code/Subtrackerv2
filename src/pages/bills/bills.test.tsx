import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { AppShell } from '../../components/layout/AppShell';
import { ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { AppToaster } from '../../components/ui/Toaster';
import { financeFixture } from '../../fixtures/finance';
import { mockMatchMedia } from '../../test/mockMatchMedia';
import type {
  BillPayment,
  FinanceData,
  ISODate,
  Installment,
  PayBillInput,
  Subscription,
  UpsertInstallmentInput,
  UpsertSubscriptionInput,
} from '../../types/finance';
import BillsPage from './index';

vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

// ---- Controllable finance hooks mock (uses real src/domain) ------------------------------------------------------

let mockData: FinanceData | undefined = financeFixture;
let mockLoading = false;
let mockError: Error | null = null;
let setMockDataState: ((next: FinanceData) => void) | null = null;

const payBillSpy = vi.fn<(input: PayBillInput) => Promise<BillPayment>>();
const deleteBillPaymentSpy = vi.fn<(id: string) => Promise<void>>();
const upsertInstallmentSpy = vi.fn<(input: UpsertInstallmentInput) => Promise<Installment>>();
const deleteInstallmentSpy = vi.fn<(id: string) => Promise<void>>();
const upsertSubscriptionSpy = vi.fn<(input: UpsertSubscriptionInput) => Promise<Subscription>>();
const deleteSubscriptionSpy = vi.fn<(id: string) => Promise<void>>();

vi.mock('../../hooks/useFinance', () => ({
  useFinanceData: () => ({ data: mockData, isLoading: mockLoading, error: mockError, refetch: vi.fn() }),
  usePayBill: () => ({
    mutate: (input: PayBillInput) => {
      void payBillSpy(input);
    },
    mutateAsync: payBillSpy,
    isPending: false,
    error: null,
  }),
  useDeleteBillPayment: () => ({
    mutate: (id: string) => {
      void deleteBillPaymentSpy(id);
    },
    mutateAsync: deleteBillPaymentSpy,
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
  payBillSpy.mockReset().mockImplementation(async (input) => {
    const created: BillPayment = {
      id: 'pay-new',
      ...input,
      createdAt: input.createdAt ?? '2026-11-15T05:00:00.000Z',
    };
    if (mockData) {
      const next = { ...mockData, payments: [...mockData.payments, created] };
      mockData = next;
      setMockDataState?.(next);
    }
    return created;
  });
  deleteBillPaymentSpy.mockReset().mockImplementation(async (id) => {
    if (mockData) {
      const next = { ...mockData, payments: mockData.payments.filter((p) => p.id !== id) };
      mockData = next;
      setMockDataState?.(next);
    }
  });
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
  vi.unstubAllGlobals();
  setMockDataState = null;
});

function StatefulBills({ today }: { today: ISODate }) {
  const [state, setState] = useState<FinanceData | undefined>(mockData);
  if (!mockLoading && !mockError && state) {
    mockData = state;
  }
  setMockDataState = setState;
  return (
    <>
      <BillsPage today={today} />
      <AppToaster />
    </>
  );
}

function renderPage(today: ISODate = '2026-11-15') {
  return render(<StatefulBills today={today} />);
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

    it('calls usePayBill when clicking "จ่ายแล้ว" and supports undo via deleteBillPayment', async () => {
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

      fireEvent.click(await screen.findByRole('button', { name: 'เลิกทำ' }));
      await waitFor(() => expect(deleteBillPaymentSpy).toHaveBeenCalledWith('pay-new'));
      await waitFor(() =>
        expect(within(cardSection).getByRole('button', { name: /จ่ายแล้ว/ })).toBeTruthy(),
      );
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

  describe('responsive layout (375 / 768 / 1280)', () => {
    function renderInShell(today: ISODate = '2026-11-15') {
      return render(
        <MemoryRouter initialEntries={['/bills']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppShell>
            <StatefulBills today={today} />
          </AppShell>
        </MemoryRouter>,
      );
    }

    it('at 375px uses mobile shell and hides summary card so mobile layout stays unchanged', () => {
      mockMatchMedia(375);
      renderInShell('2026-11-15');

      const layout = screen.getByTestId('bills-layout');
      expect(layout.className).toContain('flex-col');
      expect(layout.className).toContain('lg:grid');

      const summaryAside = screen.getByRole('complementary', { name: 'สรุปรอบนี้' });
      expect(summaryAside.className).toContain('hidden');
      expect(summaryAside.className).toContain('md:block');
      expect(screen.queryByRole('button', { name: '+ เพิ่มรายการ' })).toBeNull();
    });

    it('at 768px keeps single-column layout and places summary card at top only on บิล tab', () => {
      mockMatchMedia(768);
      renderInShell('2026-11-15');

      const layout = screen.getByTestId('bills-layout');
      expect(layout.className).toContain('flex-col');

      const summaryAside = screen.getByRole('complementary', { name: 'สรุปรอบนี้' });
      expect(summaryAside.className).toContain('hidden');
      expect(summaryAside.className).toContain('md:block');
      expect(layout.firstElementChild).toBe(summaryAside);

      // Switching to ผ่อน hides summary card on tablet while keeping it available on lg desktop.
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      expect(summaryAside.className).toContain('hidden');
      expect(summaryAside.className).toContain('lg:block');
      expect(summaryAside.className).not.toContain('md:block');
    });

    it('at 1280px renders SegmentedControl on top, single-row items on left, and 360px summary card on right', () => {
      mockMatchMedia(1280);
      renderInShell('2026-11-15');

      expect(screen.getByRole('button', { name: '+ เพิ่มรายการ' })).toBeTruthy();

      const layout = screen.getByTestId('bills-layout');
      expect(layout.className).toContain('lg:grid');
      expect(layout.className).toContain('lg:grid-cols-[minmax(0,1fr)_360px]');

      const summary = screen.getByTestId('bills-summary-card');
      expect(within(summary).getByRole('heading', { name: 'สรุปรอบนี้' })).toBeTruthy();
      expect(within(summary).getByText('บัตรเครดิต')).toBeTruthy();
      expect(within(summary).getByText('฿1,077')).toBeTruthy();
      expect(within(summary).getByText('SPayLater')).toBeTruthy();
      expect(within(summary).getByText('฿1,381')).toBeTruthy();
      expect(within(summary).getByTestId('summary-total').textContent).toBe('฿2,458.93');
      expect(within(summary).getByTestId('summary-unpaid').textContent).toBe('฿2,458.93');

      // Charge rows in บิล show date, title, pot pill, and amount (channel is in card header).
      const cardSection = screen.getByTestId('bill-card-src-card');
      expect(within(cardSection).getByText('บัตรเครดิต')).toBeTruthy();
      const claudeRow = within(cardSection).getByTestId('bill-charge-sub-sub-claude-2026-11-01-0');
      expect(within(claudeRow).getByText('Claude')).toBeTruthy();
      expect(within(claudeRow).getByText('ใช้ตามใจ')).toBeTruthy();
      expect(within(claudeRow).getByText('฿699')).toBeTruthy();

      // Summary card stays visible in right column when switching to ผ่อน / สมาชิก, and rows have single-row desktop layout.
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      expect(screen.getByTestId('bills-summary-card')).toBeTruthy();
      const instBtn = screen.getByTestId('installment-item-inst-airpods');
      expect(instBtn.className).toContain('lg:flex-row');

      fireEvent.click(screen.getByRole('tab', { name: 'สมาชิก' }));
      expect(screen.getByTestId('bills-summary-card')).toBeTruthy();
      const subRow = screen.getByTestId('subscription-item-sub-claude');
      expect(subRow.innerHTML).toContain('lg:flex lg:items-center');
    });
  });

  describe('animations and error toasts (SPEC §5)', () => {
    function wireStatefulCrudMocks() {
      upsertSubscriptionSpy.mockImplementation(async (input) => {
        const nextSub: Subscription = { id: input.id ?? 'sub-added', ...input };
        if (mockData) {
          const exists = mockData.subscriptions.some((s) => s.id === nextSub.id);
          const next = {
            ...mockData,
            subscriptions: exists
              ? mockData.subscriptions.map((s) => (s.id === nextSub.id ? nextSub : s))
              : [...mockData.subscriptions, nextSub],
          };
          mockData = next;
          setMockDataState?.(next);
        }
        return nextSub;
      });
      deleteSubscriptionSpy.mockImplementation(async (id) => {
        if (mockData) {
          const next = { ...mockData, subscriptions: mockData.subscriptions.filter((s) => s.id !== id) };
          mockData = next;
          setMockDataState?.(next);
        }
      });
      upsertInstallmentSpy.mockImplementation(async (input) => {
        const nextInst: Installment = { id: input.id ?? 'inst-added', ...input };
        if (mockData) {
          const exists = mockData.installments.some((i) => i.id === nextInst.id);
          const next = {
            ...mockData,
            installments: exists
              ? mockData.installments.map((i) => (i.id === nextInst.id ? nextInst : i))
              : [...mockData.installments, nextInst],
          };
          mockData = next;
          setMockDataState?.(next);
        }
        return nextInst;
      });
      deleteInstallmentSpy.mockImplementation(async (id) => {
        if (mockData) {
          const next = { ...mockData, installments: mockData.installments.filter((i) => i.id !== id) };
          mockData = next;
          setMockDataState?.(next);
        }
      });
    }

    it('never animates rows or summary money on initial load or tab switch', () => {
      renderPage('2026-11-15');
      expect(document.querySelectorAll('.row-enter, .row-exit')).toHaveLength(0);
      expect(document.querySelectorAll('.money-in, .money-out')).toHaveLength(0);

      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      expect(document.querySelectorAll('.row-enter, .row-exit')).toHaveLength(0);

      fireEvent.click(screen.getByRole('tab', { name: 'สมาชิก' }));
      expect(document.querySelectorAll('.row-enter, .row-exit')).toHaveLength(0);
    });

    it('animates AnimatedRow enter/exit when adding and deleting a subscription', async () => {
      wireStatefulCrudMocks();
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'สมาชิก' }));

      // Add subscription -> enters with .row-enter
      fireEvent.click(screen.getByRole('button', { name: 'เพิ่มสมาชิก' }));
      const addDialog = screen.getByRole('dialog');
      fireEvent.change(within(addDialog).getByLabelText('ชื่อสมาชิก'), { target: { value: 'Figma' } });
      fireEvent.change(within(addDialog).getByLabelText('ยอดเงิน'), { target: { value: '500' } });
      fireEvent.change(within(addDialog).getByLabelText('วันตัดเงิน (1–31)'), { target: { value: '5' } });
      fireEvent.click(within(addDialog).getByRole('button', { name: 'บันทึก' }));

      const addedRow = await screen.findByTestId('subscription-item-sub-added');
      expect(addedRow.closest('.row-enter')).toBeTruthy();

      // Delete subscription -> exits with .row-exit for ROW_EXIT_MS then unmounts
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      fireEvent.click(addedRow);
      const editDialog = screen.getByRole('dialog');
      const holdBtn = within(editDialog).getByRole('button', { name: /กดค้างเพื่อลบ/ });
      fireEvent.pointerDown(holdBtn);
      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      const leavingRow = screen.getByTestId('subscription-item-sub-added').closest('[data-leaving="true"]');
      expect(leavingRow).toBeTruthy();
      expect(leavingRow!.className).toContain('row-exit');

      await act(async () => {
        vi.advanceTimersByTime(ROW_EXIT_MS);
      });
      expect(screen.queryByTestId('subscription-item-sub-added')).toBeNull();
    });

    it('animates AnimatedRow enter/exit when adding and deleting an installment', async () => {
      wireStatefulCrudMocks();
      renderPage('2026-11-15');
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));

      fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการผ่อน' }));
      const addDialog = screen.getByRole('dialog');
      fireEvent.change(within(addDialog).getByLabelText('ชื่อรายการ'), { target: { value: 'Keyboard' } });
      fireEvent.change(within(addDialog).getByLabelText('ยอดต่องวด'), { target: { value: '200' } });
      fireEvent.change(within(addDialog).getByLabelText('จำนวนงวด'), { target: { value: '5' } });
      fireEvent.change(within(addDialog).getByLabelText('วันที่งวดแรก'), { target: { value: '2026-11-05' } });
      fireEvent.click(within(addDialog).getByRole('button', { name: 'บันทึก' }));

      const addedInst = await screen.findByTestId('installment-item-inst-added');
      expect(addedInst.closest('.row-enter')).toBeTruthy();

      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      fireEvent.click(addedInst);
      const editDialog = screen.getByRole('dialog');
      const holdBtn = within(editDialog).getByRole('button', { name: /กดค้างเพื่อลบ/ });
      fireEvent.pointerDown(holdBtn);
      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      const leavingInst = screen.getByTestId('installment-item-inst-added').closest('[data-leaving="true"]');
      expect(leavingInst).toBeTruthy();
      expect(leavingInst!.className).toContain('row-exit');

      await act(async () => {
        vi.advanceTimersByTime(ROW_EXIT_MS);
      });
      expect(screen.queryByTestId('installment-item-inst-added')).toBeNull();
    });

    it('animates bill payment transition and summary AnimatedMoney when paying a bill', async () => {
      mockMatchMedia(1280);
      renderPage('2026-11-15');

      const unpaidBox = screen.getByTestId('summary-unpaid');
      expect(unpaidBox.textContent).toBe('฿2,458.93');

      const cardSection = screen.getByTestId('bill-card-src-card');
      fireEvent.click(within(cardSection).getByRole('button', { name: /จ่ายแล้ว/ }));

      await waitFor(() => expect(payBillSpy).toHaveBeenCalled());
      // Summary AnimatedMoney crossfades unpaid total from 2,458.93 -> 1,381.93
      expect(unpaidBox.querySelector('.money-out')).toBeTruthy();
      expect(unpaidBox.querySelector('.money-in')).toBeTruthy();
      expect(unpaidBox.textContent).toContain('฿1,381.93');
      // Outgoing action exits via AnimatedRow
      expect(cardSection.querySelector('.row-exit')).toBeTruthy();
    });

    it('shows error toast with repo error message when paying, saving, or deleting fails', async () => {
      renderPage('2026-11-15');

      // 1. Pay bill error
      payBillSpy.mockRejectedValueOnce(new Error('เชื่อมต่อฐานข้อมูลไม่ได้'));
      const cardSection = screen.getByTestId('bill-card-src-card');
      fireEvent.click(within(cardSection).getByRole('button', { name: /จ่ายแล้ว/ }));
      expect(await screen.findByText(/บันทึกจ่ายบิลไม่สำเร็จ.*เชื่อมต่อฐานข้อมูลไม่ได้/)).toBeTruthy();

      // 2. Save installment error
      upsertInstallmentSpy.mockRejectedValueOnce(new Error('บันทึกผ่อนล้มเหลว'));
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการผ่อน' }));
      const instDialog = screen.getByRole('dialog');
      fireEvent.change(within(instDialog).getByLabelText('ชื่อรายการ'), { target: { value: 'Mouse' } });
      fireEvent.change(within(instDialog).getByLabelText('ยอดต่องวด'), { target: { value: '200' } });
      fireEvent.change(within(instDialog).getByLabelText('จำนวนงวด'), { target: { value: '3' } });
      fireEvent.change(within(instDialog).getByLabelText('วันที่งวดแรก'), { target: { value: '2026-11-01' } });
      fireEvent.click(within(instDialog).getByRole('button', { name: 'บันทึก' }));
      expect(await screen.findByText(/บันทึกไม่สำเร็จ.*บันทึกผ่อนล้มเหลว/)).toBeTruthy();

      // Close sheet before next check
      fireEvent.click(within(instDialog).getByRole('button', { name: 'ปิด' }));

      // 3. Save & delete subscription error
      upsertSubscriptionSpy.mockRejectedValueOnce(new Error('บันทึกสมาชิกล้มเหลว'));
      fireEvent.click(screen.getByRole('tab', { name: 'สมาชิก' }));
      fireEvent.click(screen.getByRole('button', { name: 'เพิ่มสมาชิก' }));
      const subDialog = screen.getByRole('dialog');
      fireEvent.change(within(subDialog).getByLabelText('ชื่อสมาชิก'), { target: { value: 'Spotify' } });
      fireEvent.change(within(subDialog).getByLabelText('ยอดเงิน'), { target: { value: '129' } });
      fireEvent.change(within(subDialog).getByLabelText('วันตัดเงิน (1–31)'), { target: { value: '5' } });
      fireEvent.click(within(subDialog).getByRole('button', { name: 'บันทึก' }));
      expect(await screen.findByText(/บันทึกไม่สำเร็จ.*บันทึกสมาชิกล้มเหลว/)).toBeTruthy();
      fireEvent.click(within(subDialog).getByRole('button', { name: 'ปิด' }));

      // 4. Delete subscription error
      deleteSubscriptionSpy.mockRejectedValueOnce(new Error('สิทธิ์ไม่เพียงพอ'));
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      fireEvent.click(screen.getByTestId('subscription-item-sub-claude'));
      const editSubDialog = screen.getByRole('dialog');
      const holdBtn = within(editSubDialog).getByRole('button', { name: /กดค้างเพื่อลบ/ });
      fireEvent.pointerDown(holdBtn);
      await act(async () => {
        vi.advanceTimersByTime(1200);
      });
      await act(async () => {
        vi.advanceTimersByTime(50);
      });
      vi.useRealTimers();
      expect(await screen.findByText(/ลบไม่สำเร็จ.*สิทธิ์ไม่เพียงพอ/)).toBeTruthy();
    });

    it('supports swipe-to-delete with undo on SubscriptionsTab and InstallmentsTab', async () => {
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

      deleteSubscriptionSpy.mockImplementation(async (id) => {
        if (mockData) {
          const next = { ...mockData, subscriptions: mockData.subscriptions.filter((s) => s.id !== id) };
          mockData = next;
          setMockDataState?.(next);
        }
      });
      upsertSubscriptionSpy.mockImplementation(async (input) => {
        const saved: Subscription = { id: input.id ?? 'sub-restored', ...input };
        if (mockData) {
          const next = { ...mockData, subscriptions: [...mockData.subscriptions, saved] };
          mockData = next;
          setMockDataState?.(next);
        }
        return saved;
      });
      deleteInstallmentSpy.mockImplementation(async (id) => {
        if (mockData) {
          const next = { ...mockData, installments: mockData.installments.filter((i) => i.id !== id) };
          mockData = next;
          setMockDataState?.(next);
        }
      });
      upsertInstallmentSpy.mockImplementation(async (input) => {
        const saved: Installment = { id: input.id ?? 'inst-restored', ...input };
        if (mockData) {
          const next = { ...mockData, installments: [...mockData.installments, saved] };
          mockData = next;
          setMockDataState?.(next);
        }
        return saved;
      });

      renderPage('2026-11-15');

      // Subscriptions tab: swipe full left to delete Claude, then undo
      fireEvent.click(screen.getByRole('tab', { name: 'สมาชิก' }));
      const claudeTrack = screen.getByTestId('subscription-item-sub-claude').closest('[data-testid="swipe-track"]') as HTMLElement;
      fireEvent.pointerDown(claudeTrack, { pointerId: 1, clientX: 300, clientY: 20, pointerType: 'touch' });
      fireEvent.pointerMove(claudeTrack, { pointerId: 1, clientX: 80, clientY: 20, pointerType: 'touch' });
      fireEvent.pointerUp(claudeTrack, { pointerId: 1, clientX: 80, clientY: 20, pointerType: 'touch' });

      await waitFor(() => expect(deleteSubscriptionSpy).toHaveBeenCalledWith('sub-claude'));
      const subToast = await screen.findByText('ลบClaudeแล้ว');
      const subToastEl = subToast.closest('li') ?? subToast.parentElement!.parentElement!;
      fireEvent.click(within(subToastEl).getByRole('button', { name: 'เลิกทำ' }));
      await waitFor(() => expect(upsertSubscriptionSpy).toHaveBeenCalled());
      expect(await screen.findByText('Claude')).toBeTruthy();

      // Installments tab: swipe open and tap "ลบ" on AirPods, then undo
      fireEvent.click(screen.getByRole('tab', { name: 'ผ่อน' }));
      const airpodsTrack = screen.getByTestId('installment-item-inst-airpods').closest('[data-testid="swipe-track"]') as HTMLElement;
      fireEvent.pointerDown(airpodsTrack, { pointerId: 2, clientX: 250, clientY: 20, pointerType: 'touch' });
      fireEvent.pointerMove(airpodsTrack, { pointerId: 2, clientX: 180, clientY: 20, pointerType: 'touch' });
      fireEvent.pointerUp(airpodsTrack, { pointerId: 2, clientX: 180, clientY: 20, pointerType: 'touch' });
      fireEvent.click(within(airpodsTrack.parentElement!).getByRole('button', { name: 'ลบ' }));

      await waitFor(() => expect(deleteInstallmentSpy).toHaveBeenCalledWith('inst-airpods'));
      const instToast = await screen.findByText('ลบAirPodsแล้ว');
      const instToastEl = instToast.closest('li') ?? instToast.parentElement!.parentElement!;
      fireEvent.click(within(instToastEl).getByRole('button', { name: 'เลิกทำ' }));
      await waitFor(() => expect(upsertInstallmentSpy).toHaveBeenCalled());
      expect(await screen.findByText('AirPods')).toBeTruthy();
    });
  });
});
