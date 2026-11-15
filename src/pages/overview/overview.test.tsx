import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AppShell } from '../../components/layout/AppShell';
import { ROW_EXIT_MS } from '../../components/ui/AnimatedRow';
import { AppToaster } from '../../components/ui/Toaster';
import { financeFixture } from '../../fixtures/finance';
import { mockMatchMedia } from '../../test/mockMatchMedia';
import type {
  BillPayment,
  CreateTransactionInput,
  ISODate,
  Outflow,
  PayBillInput,
  Pot,
  Transaction,
  UseFinanceData,
} from '../../types/finance';
import * as domain from '../../domain';
import * as financeHooks from '../../hooks/useFinance';
import OverviewPage from './index';

// Mock ThemeProvider so AppToaster reads a deterministic theme without touching localStorage.
vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

const TODAY: ISODate = '2026-11-15';

let mockFinanceState: UseFinanceData = {
  data: financeFixture,
  isLoading: false,
  error: null,
};

let createTxSpy = vi.fn<(input: CreateTransactionInput) => Promise<Transaction>>();
let deleteTxSpy = vi.fn<(id: string) => Promise<void>>();
let payBillSpy = vi.fn<(input: PayBillInput) => Promise<BillPayment>>();
let deleteBillPaymentSpy = vi.fn<(id: string) => Promise<void>>();

function LocationProbe({
  onUpdate,
}: {
  onUpdate: (loc: { pathname: string; search: string }, navigate: ReturnType<typeof useNavigate>) => void;
}) {
  const loc = useLocation();
  const navigate = useNavigate();
  onUpdate({ pathname: loc.pathname, search: loc.search }, navigate);
  return null;
}

function renderOverview(options?: {
  initialEntries?: string[];
  withShell?: boolean;
  onLocation?: (loc: { pathname: string; search: string }, navigate: ReturnType<typeof useNavigate>) => void;
}) {
  const { initialEntries = ['/'], withShell = false, onLocation } = options ?? {};
  const pageRoute = <Route path="/" element={<OverviewPage today={TODAY} />} />;
  return render(
    <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {withShell ? (
          <Route element={<AppShell />}>
            {pageRoute}
            <Route path="/bills" element={<h1>บิล & ผ่อน</h1>} />
            <Route path="/entries" element={<h1>รายการ</h1>} />
            <Route path="/settings" element={<h1>ตั้งค่า</h1>} />
          </Route>
        ) : (
          <>
            {pageRoute}
            <Route path="/bills" element={<h1>บิล & ผ่อน</h1>} />
            <Route path="/entries" element={<h1>รายการ</h1>} />
            <Route path="/settings" element={<h1>ตั้งค่า</h1>} />
          </>
        )}
      </Routes>
      {onLocation ? <LocationProbe onUpdate={onLocation} /> : null}
      <AppToaster />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockFinanceState = { data: financeFixture, isLoading: false, error: null };
  createTxSpy = vi.fn(async (input) => ({ id: 'tx-new-1', ...input }));
  deleteTxSpy = vi.fn(async () => {});
  payBillSpy = vi.fn(async (input) => ({ id: 'pay-new-1', ...input }));
  deleteBillPaymentSpy = vi.fn(async () => {});

  vi.spyOn(financeHooks, 'useFinanceData').mockImplementation(() => mockFinanceState);
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
  vi.spyOn(financeHooks, 'usePayBill').mockImplementation(() => ({
    mutate: (input) => {
      void payBillSpy(input);
    },
    mutateAsync: payBillSpy,
    isPending: false,
    error: null,
  }));
  vi.spyOn(financeHooks, 'useDeleteBillPayment').mockImplementation(() => ({
    mutate: (id) => {
      void deleteBillPaymentSpy(id);
    },
    mutateAsync: deleteBillPaymentSpy,
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
});

const playLeft = () => screen.getByTestId('play-left');
const owed = () => screen.getByTestId('owed');
const tileAmount = (label: string) => screen.getByText(label).parentElement!.textContent!.slice(label.length);

describe('<OverviewPage>', () => {
  it('shows header, period from payPeriod, days left, and 662.07 from fixtures', () => {
    renderOverview();
    expect(screen.getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(screen.getByText('รอบ 10 พ.ย. – 9 ธ.ค. · อีก 25 วัน')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'เพิ่มรายการ' })).toBeTruthy();

    expect(playLeft().textContent).toBe('฿662.07');
    expect(playLeft().querySelector('.text-money-xl')).toBeTruthy();
    expect(document.querySelectorAll('.text-money-xl')).toHaveLength(1);

    expect(owed().textContent).toBe('฿2,458.93');
    expect(screen.getByRole('img', { name: 'เหลือ ฿662.07' })).toBeTruthy();

    expect(tileAmount('บัตรเครดิต · 24 พ.ย.')).toBe('฿1,077.00');
    expect(tileAmount('SPayLater · ≤10 ธ.ค.')).toBe('฿1,381.93');
    expect(tileAmount('ใช้เล่นไปแล้ว')).toBe('฿420.00');
    expect(tileAmount('ก้อน 3,000 + ยกมา 541')).toBe('฿3,541.00');
  });

  it('shows essential pot (pot 2) in a single row with spent, budget, and left', () => {
    mockFinanceState = {
      ...mockFinanceState,
      data: {
        ...financeFixture,
        transactions: [
          ...financeFixture.transactions,
          {
            id: 'tx-nov-essential',
            date: '2026-11-12',
            amount: 250_000,
            direction: 'out',
            sourceId: 'src-bank',
            potId: 'pot-essential',
            category: 'other',
            note: 'ค่าห้อง',
          },
        ],
      },
    };
    renderOverview();
    const essential = screen.getByTestId('essential-pot');
    expect(within(essential).getByRole('heading', { level: 2, name: 'ใช้จ่ายจำเป็น' })).toBeTruthy();
    expect(within(essential).getByText('ใช้ไป')).toBeTruthy();
    expect(within(essential).getByText('งบ')).toBeTruthy();
    expect(within(essential).getByText('เหลือ')).toBeTruthy();
    expect(essential.textContent).toContain('฿2,500.00');
    expect(essential.textContent).toContain('฿7,200.00');
    expect(essential.textContent).toContain('฿4,700.00');
  });

  it('renders upcoming outflows with bills strong + pay button, charges with Pill + เข้าบิล <เดือน>, and total excluding charges', () => {
    renderOverview();
    const upcoming = screen.getByTestId('upcoming');
    expect(within(upcoming).getByText('บิล บัตรเครดิต')).toBeTruthy();
    expect(within(upcoming).getByText('Gemini + YouTube')).toBeTruthy();
    expect(within(upcoming).getByText('Claude')).toBeTruthy();
    expect(within(upcoming).getByText('iCloud')).toBeTruthy();
    expect(within(upcoming).getByText('บิล SPayLater')).toBeTruthy();

    // Charge rows show channel pill and "เข้าบิล ธ.ค."
    expect(within(upcoming).getAllByText('เข้าบิล ธ.ค.')).toHaveLength(3);
    // Total outflow counts only bills (1,077.00 + 1,381.93 = 2,458.93), never charges.
    expect(screen.getByTestId('upcoming-total').textContent).toBe('฿2,458.93');
  });

  it('caps upcoming outflows at 5 rows and navigates to /bills on ดูทั้งหมด', () => {
    const base = domain.upcomingOutflows(financeFixture, TODAY);
    vi.spyOn(domain, 'upcomingOutflows').mockReturnValue([
      ...base,
      {
        date: '2026-12-12',
        dueBy: false,
        title: 'Netflix',
        amount: 41_900,
        sourceId: 'src-card',
        kind: 'charge',
        counted: false,
        statementKey: '2027-01',
      } satisfies Outflow,
    ]);
    renderOverview();
    const upcoming = screen.getByTestId('upcoming');
    expect(within(upcoming).queryByText('Netflix')).toBeNull();

    fireEvent.click(within(upcoming.parentElement!).getByRole('button', { name: 'ดูทั้งหมด' }));
    expect(screen.getByRole('heading', { level: 1, name: 'บิล & ผ่อน' })).toBeTruthy();
  });

  it('calls usePayBill only once on double-tap and moves focus to owed region with preventScroll', async () => {
    renderOverview();
    const payButtons = screen.getAllByRole('button', { name: 'จ่ายแล้ว' });
    const firstPay = payButtons[0];
    const target = owed().closest('[role="status"]') as HTMLElement;
    const focusSpy = vi.spyOn(target, 'focus');

    firstPay.focus();
    act(() => {
      fireEvent.click(firstPay);
      fireEvent.click(firstPay);
    });

    expect(payBillSpy).toHaveBeenCalledTimes(1);
    expect(payBillSpy).toHaveBeenCalledWith({
      sourceId: 'src-card',
      statementKey: '2026-11',
      amount: 107_700,
      paidOn: TODAY,
    });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    focusSpy.mockRestore();
  });

  it('opens quick-add BottomSheet (no Switch), validates, calls useCreateTransaction, and supports toast undo', async () => {
    renderOverview();
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('จำนวนเงิน')).toBeTruthy();
    expect(within(dialog).getByRole('tablist', { name: 'ช่องทางจ่าย' })).toBeTruthy();
    expect(within(dialog).getByRole('tablist', { name: 'ก้อนเงิน' })).toBeTruthy();
    expect(within(dialog).getByRole('group', { name: 'หมวดหมู่' })).toBeTruthy();
    expect(within(dialog).queryByRole('switch')).toBeNull();

    // Empty amount shows error and keeps sheet open.
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));
    expect(within(dialog).getByText('กรอกจำนวนเงินให้ถูกต้อง')).toBeTruthy();
    expect(createTxSpy).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '125.50' } });
    fireEvent.click(within(dialog).getByRole('tab', { name: 'บัตรเครดิต' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'อาหาร' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    await waitFor(() => expect(createTxSpy).toHaveBeenCalledTimes(1));
    expect(createTxSpy).toHaveBeenCalledWith({
      date: TODAY,
      amount: 12_550,
      direction: 'out',
      sourceId: 'src-card',
      potId: 'pot-play',
      category: 'food',
      note: '',
    });

    expect(await screen.findByText('บันทึกแล้ว')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'เลิกทำ' }));
    await waitFor(() => expect(deleteTxSpy).toHaveBeenCalledWith('tx-new-1'));
  });

  it('renders over-budget status tokens when potStatus.over is true', () => {
    const realPotStatus = domain.potStatus;
    vi.spyOn(domain, 'potStatus').mockImplementation((pot: Pot, periodKey, data) => {
      if (pot.id === 'pot-essential') return realPotStatus(pot, periodKey, data);
      return {
        carryIn: 0,
        budget: 300_000,
        reserved: 245_893,
        spent: 79_107,
        left: -25_000,
        over: true,
      };
    });
    renderOverview();
    expect(playLeft().textContent).toBe('−฿250.00');
    expect(playLeft().querySelector('.text-negative')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'เกินงบ ฿250.00' }).className).toContain('outline-negative');
  });

  it('renders Skeleton loading state when isLoading is true', () => {
    mockFinanceState = { data: undefined, isLoading: true, error: null };
    renderOverview();
    expect(screen.getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(screen.getByRole('status', { name: 'กำลังโหลด' })).toBeTruthy();
    expect(screen.queryByTestId('play-left')).toBeNull();
  });

  it('renders ErrorState with retry button when useFinanceData returns an error', () => {
    const refetch = vi.fn();
    mockFinanceState = {
      data: undefined,
      isLoading: false,
      error: new Error('network failed'),
      refetch,
    } as UseFinanceData;
    renderOverview();
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ลองใหม่' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders ErrorState instead of crashing when domain calculation throws', () => {
    vi.spyOn(domain, 'payPeriod').mockImplementation(() => {
      throw new Error('domain failure');
    });
    renderOverview();
    expect(screen.getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ลองใหม่' })).toBeTruthy();
  });

  it('renders EmptyState inviting to settings when data is missing or unconfigured', () => {
    mockFinanceState = { data: undefined, isLoading: false, error: null };
    renderOverview();
    expect(screen.getByText('ยังไม่มีข้อมูลบัญชีหรือก้อนเงิน เริ่มต้นได้ในหน้าตั้งค่า')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ไปตั้งค่า' }));
    expect(screen.getByRole('heading', { level: 1, name: 'ตั้งค่า' })).toBeTruthy();
  });

  it('keeps playLeft at 662.07 and drops owed to 1,381.93 after card bill payment is recorded', () => {
    mockFinanceState = {
      data: {
        ...financeFixture,
        payments: [
          ...financeFixture.payments,
          {
            id: 'pay-nov-card',
            sourceId: 'src-card',
            statementKey: '2026-11',
            amount: 107_700,
            paidOn: TODAY,
          },
        ],
      },
      isLoading: false,
      error: null,
    };
    renderOverview();
    expect(playLeft().textContent).toBe('฿662.07');
    expect(owed().textContent).toBe('฿1,381.93');
    expect(tileAmount('บัตรเครดิต · จ่ายแล้ว')).toBe('฿1,077.00');
    expect(tileAmount('ใช้เล่นไปแล้ว')).toBe('฿420.00');
    expect(screen.getByRole('img', { name: 'เหลือ ฿662.07' })).toBeTruthy();
    expect(document.querySelector('[data-segment="src-card"]')!.className).toContain('opacity-50');
  });

  it('at 375px keeps single-column mobile layout with recent transactions hidden', () => {
    mockMatchMedia(375);
    renderOverview({ withShell: true });

    const grid = screen.getByTestId('overview-layout');
    expect(grid.className).toContain('flex-col');
    expect(grid.className).toContain('lg:grid-cols-[minmax(0,1fr)_360px]');

    const potsGrid = screen.getByTestId('pots-grid');
    expect(potsGrid.className).toContain('md:grid-cols-2');

    // Essential pot stays at the bottom on mobile (order-4) while shifting into the 2-pot grid at md+.
    expect(screen.getByTestId('essential-pot').className).toContain('order-4');
    expect(screen.getByTestId('essential-pot').className).toContain('md:order-2');

    // Recent transactions are desktop-only so mobile 375px stays unchanged.
    expect(screen.getByTestId('recent-transactions').className).toContain('hidden');
    expect(screen.getByTestId('recent-transactions').className).toContain('lg:block');

    // Quick add uses bottom sheet on mobile.
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    expect(screen.getByRole('dialog').getAttribute('data-vaul-drawer-direction')).toBe('bottom');
  });

  it('at 1280px renders 2-column desktop layout with pots side by side, upcoming, and 5 recent entries', () => {
    mockMatchMedia(1280);
    renderOverview({ withShell: true });

    const grid = screen.getByTestId('overview-layout');
    expect(grid.className).toContain('lg:grid');
    expect(grid.className).toContain('lg:grid-cols-[minmax(0,1fr)_360px]');

    const leftCol = screen.getByTestId('overview-left');
    const rightCol = screen.getByTestId('overview-right');

    expect(within(leftCol).getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(within(leftCol).getByTestId('pots-grid').className).toContain('md:grid-cols-2');
    expect(within(leftCol).getByTestId('essential-pot')).toBeTruthy();
    expect(within(leftCol).getByRole('img', { name: 'เหลือ ฿662.07' })).toBeTruthy();

    expect(within(rightCol).getByTestId('upcoming')).toBeTruthy();
    const recent = within(rightCol).getByTestId('recent-transactions');
    expect(within(recent).getByRole('heading', { level: 2, name: 'รายการล่าสุด' })).toBeTruthy();
    // Fixture has 3 transactions in Nov period (and 1 in Oct which must be excluded).
    expect(within(recent).getByText('เกม')).toBeTruthy();
    expect(within(recent).getByText('ชานม')).toBeTruthy();
    expect(within(recent).getByText('หนัง')).toBeTruthy();
    expect(within(recent).queryByText('ปรับยอดยกมา')).toBeNull();

    // Quick add uses right-side drawer on desktop.
    fireEvent.click(screen.getByRole('button', { name: '+ เพิ่มรายการ' }));
    expect(screen.getByRole('dialog').getAttribute('data-vaul-drawer-direction')).toBe('right');
  });

  it('caps recent transactions at 5 latest entries of the current period and navigates to /entries', () => {
    mockMatchMedia(1280);
    const extraTx: Transaction[] = [
      { id: 'tx-nov-1', date: '2026-11-10', amount: 5_000, direction: 'out', sourceId: 'src-bank', potId: 'pot-play', category: 'food', note: 'ข้าวเช้า' },
      { id: 'tx-nov-2', date: '2026-11-11', amount: 6_000, direction: 'out', sourceId: 'src-bank', potId: 'pot-play', category: 'food', note: 'กาแฟ' },
      { id: 'tx-nov-3', date: '2026-11-15', amount: 7_000, direction: 'out', sourceId: 'src-card', potId: 'pot-play', category: 'shopping', note: 'ของใช้' },
    ];
    mockFinanceState = {
      ...mockFinanceState,
      data: {
        ...financeFixture,
        transactions: [...extraTx, ...financeFixture.transactions],
      },
    };
    renderOverview();

    const recent = screen.getByTestId('recent-transactions');
    // 6 Nov transactions exist; oldest ('ข้าวเช้า' on Nov 10) must be dropped by the 5-row cap.
    expect(within(recent).getByText('ของใช้')).toBeTruthy();
    expect(within(recent).getByText('เกม')).toBeTruthy();
    expect(within(recent).getByText('ชานม')).toBeTruthy();
    expect(within(recent).getByText('หนัง')).toBeTruthy();
    expect(within(recent).getByText('กาแฟ')).toBeTruthy();
    expect(within(recent).queryByText('ข้าวเช้า')).toBeNull();

    fireEvent.click(within(recent).getByRole('button', { name: 'ดูทั้งหมด' }));
    expect(screen.getByRole('heading', { level: 1, name: 'รายการ' })).toBeTruthy();
  });

  it('opens QuickAddSheet once on /?add=1, strips add with replace, and does not reopen on back', async () => {
    mockMatchMedia(1280);
    let currentLoc = { pathname: '/', search: '' };
    let navFn: ReturnType<typeof useNavigate> | null = null;

    renderOverview({
      initialEntries: ['/bills', '/?add=1'],
      onLocation: (loc, nav) => {
        currentLoc = loc;
        navFn = nav;
      },
    });

    expect(await screen.findByRole('dialog')).toBeTruthy();
    await waitFor(() => {
      expect(currentLoc.pathname).toBe('/');
      expect(currentLoc.search).toBe('');
    });

    // Close the sheet, navigate away, then go back -> sheet must stay closed.
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    act(() => {
      navFn!('/entries');
    });
    expect(screen.getByRole('heading', { level: 1, name: 'รายการ' })).toBeTruthy();

    act(() => {
      navFn!(-1);
    });
    expect(screen.getByRole('heading', { level: 1, name: 'ภาพรวม' })).toBeTruthy();
    expect(currentLoc.search).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not play row enter/exit animations on initial mount', () => {
    const { container } = renderOverview();
    expect(container.querySelector('.row-enter')).toBeNull();
    expect(container.querySelector('.row-exit')).toBeNull();
    expect(container.querySelector('[data-leaving="true"]')).toBeNull();
    expect(container.querySelector('.money-in')).toBeNull();
    expect(container.querySelector('.money-out')).toBeNull();
  });

  it('animates newly added recent row on enter, paid bill row on exit, and shows bill-specific + error toasts', async () => {
    mockMatchMedia(1280);
    // Simulate reactive query data updates when createTransaction or payBill succeeds.
    createTxSpy = vi.fn(async (input) => {
      const created: Transaction = { id: 'tx-added-anim', ...input };
      mockFinanceState = {
        ...mockFinanceState,
        data: {
          ...mockFinanceState.data!,
          transactions: [created, ...mockFinanceState.data!.transactions],
        },
      };
      return created;
    });
    payBillSpy = vi.fn(async (input) => {
      const payment: BillPayment = { id: 'pay-anim-1', ...input };
      mockFinanceState = {
        ...mockFinanceState,
        data: {
          ...mockFinanceState.data!,
          payments: [payment, ...mockFinanceState.data!.payments],
        },
      };
      return payment;
    });

    const { rerender } = renderOverview();

    // 1. Quick add -> "บันทึกแล้ว" toast + new row gets .row-enter (existing rows do not).
    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '99' } });
    fireEvent.change(within(dialog).getByLabelText('โน้ต (ไม่บังคับ)'), { target: { value: 'มัทฉะ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    expect(await screen.findByText('บันทึกแล้ว')).toBeTruthy();
    // Rerender to reflect updated mockFinanceState from query invalidation.
    rerender(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<OverviewPage today={TODAY} />} />
        </Routes>
        <AppToaster />
      </MemoryRouter>,
    );

    const recent = screen.getByTestId('recent-transactions');
    const addedTitle = within(recent).getByText('มัทฉะ');
    expect(addedTitle.closest('.row-enter')).toBeTruthy();
    expect(within(recent).getByText('เกม').closest('.row-enter')).toBeNull();
    // AnimatedMoney on play-left crossfades on change.
    expect(screen.getByTestId('play-left').querySelector('.money-in')).toBeTruthy();

    // 2. Pay bill -> toast "จ่ายบิล บัตรเครดิตแล้ว" + exiting row plays .row-exit before unmounting.
    const payButtons = screen.getAllByRole('button', { name: 'จ่ายแล้ว' });
    const upcoming = screen.getByTestId('upcoming');
    fireEvent.click(payButtons[0]);

    await waitFor(() => {
      const exitingRow = within(upcoming).getByText('บิล บัตรเครดิต').closest('[data-leaving="true"]');
      expect(exitingRow).toBeTruthy();
      expect(exitingRow!.className).toContain('row-exit');
    });
    expect(await screen.findByText('จ่ายบิล บัตรเครดิตแล้ว')).toBeTruthy();
    rerender(
      <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<OverviewPage today={TODAY} />} />
        </Routes>
        <AppToaster />
      </MemoryRouter>,
    );

    await waitFor(() => expect(within(upcoming).queryByText('บิล บัตรเครดิต')).toBeNull(), {
      timeout: ROW_EXIT_MS + 1000,
    });
  });

  it('shows error toast when quick add or bill payment fails', async () => {
    createTxSpy = vi.fn(async () => {
      throw new Error('เพิ่มรายการล้มเหลวจากเซิร์ฟเวอร์');
    });
    payBillSpy = vi.fn(async () => {
      throw new Error('เครือข่ายขัดข้อง');
    });

    renderOverview();

    fireEvent.click(screen.getByRole('button', { name: 'เพิ่มรายการ' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('จำนวนเงิน'), { target: { value: '50' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'บันทึก' }));

    expect(await screen.findByText(/เพิ่มรายการล้มเหลวจากเซิร์ฟเวอร์/)).toBeTruthy();
    // Sheet stays open on error.
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ปิด' }));

    const payButtons = screen.getAllByRole('button', { name: 'จ่ายแล้ว' });
    fireEvent.click(payButtons[0]);
    expect(await screen.findByText(/เครือข่ายขัดข้อง/)).toBeTruthy();
  });
});
