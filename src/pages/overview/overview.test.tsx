import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { financeFixture } from '../../fixtures/finance';
import type {
  BillPayment,
  CreateTransactionInput,
  FinanceData,
  ISODate,
  Outflow,
  PayBillInput,
  PaymentSource,
  PeriodKey,
  Pot,
  PotStatus,
  Satang,
  Transaction,
  UseFinanceData,
} from '../../types/finance';
import { AppToaster } from '../../components/ui/Toaster';
import * as domain from '../../domain';
import * as financeHooks from '../../hooks/useFinance';
import OverviewPage from './index';

// Mock ThemeProvider so AppToaster reads a deterministic theme without touching localStorage.
vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => ({ pref: 'light', resolved: 'light', setPref: () => {} }),
}));

// Mock domain functions so OverviewPage tests can verify SPEC §4 behaviour independently of prompt 02.
vi.mock('../../domain', () => ({
  payPeriod: vi.fn(),
  statementFor: vi.fn(),
  subscriptionCharges: vi.fn(),
  installmentSchedule: vi.fn(),
  billAmount: vi.fn(),
  upcomingOutflows: vi.fn(),
  potStatus: vi.fn(),
}));

const TODAY: ISODate = '2026-11-15';

const BASE_OUTFLOWS: Outflow[] = [
  {
    date: '2026-11-24',
    dueBy: false,
    title: 'จ่ายบิลบัตรเครดิต',
    amount: 107_700,
    sourceId: 'src-card',
    kind: 'bill',
    counted: true,
    statementKey: '2026-11',
  },
  {
    date: '2026-11-25',
    dueBy: false,
    title: 'Gemini + YouTube',
    amount: 27_900,
    sourceId: 'src-card',
    kind: 'charge',
    counted: false,
    statementKey: '2026-12',
  },
  {
    date: '2026-12-01',
    dueBy: false,
    title: 'Claude',
    amount: 69_900,
    sourceId: 'src-card',
    kind: 'charge',
    counted: false,
    statementKey: '2026-12',
  },
  {
    date: '2026-12-03',
    dueBy: false,
    title: 'iCloud',
    amount: 9_900,
    sourceId: 'src-card',
    kind: 'charge',
    counted: false,
    statementKey: '2026-12',
  },
  {
    date: '2026-12-10',
    dueBy: true,
    title: 'AirPods งวด 3/10',
    amount: 138_193,
    sourceId: 'src-spay',
    kind: 'bill',
    counted: true,
    statementKey: '2026-11',
  },
];

const PLAY_STATUS_OPEN: PotStatus = {
  carryIn: 54_100,
  budget: 354_100,
  reserved: 245_893,
  spent: 42_000,
  left: 66_207,
  over: false,
};

const ESSENTIAL_STATUS: PotStatus = {
  carryIn: 0,
  budget: 720_000,
  reserved: 0,
  spent: 250_000,
  left: 470_000,
  over: false,
};

function setupDefaultDomainMocks() {
  vi.mocked(domain.payPeriod).mockReturnValue({
    key: '2026-11',
    start: '2026-11-10',
    end: '2026-12-09',
  });

  vi.mocked(domain.statementFor).mockImplementation((src: PaymentSource, chargeDate: ISODate) => {
    if (src.kind === 'credit_card') {
      if (chargeDate < '2026-11-10') {
        return { key: '2026-11', start: '2026-10-10', end: '2026-11-09', dueDate: '2026-11-24' };
      }
      return { key: '2026-12', start: '2026-11-10', end: '2026-12-09', dueDate: '2026-12-24' };
    }
    return { key: '2026-11', start: '2026-11-01', end: '2026-11-30', dueDate: '2026-12-10' };
  });

  vi.mocked(domain.billAmount).mockImplementation((src: PaymentSource, statementKey: PeriodKey): Satang => {
    if (src.id === 'src-card' && statementKey === '2026-11') return 107_700;
    if (src.id === 'src-spay' && statementKey === '2026-11') return 138_193;
    return 0;
  });

  vi.mocked(domain.upcomingOutflows).mockImplementation((data: FinanceData) => {
    const paidSet = new Set(data.payments.map((p) => `${p.sourceId}:${p.statementKey}`));
    return BASE_OUTFLOWS.filter(
      (o) => o.kind !== 'bill' || !paidSet.has(`${o.sourceId}:${o.statementKey ?? ''}`),
    );
  });

  vi.mocked(domain.potStatus).mockImplementation((pot: Pot, _periodKey: PeriodKey, data: FinanceData) => {
    if (pot.id === 'pot-essential') return ESSENTIAL_STATUS;
    const cardPaid = data.payments.some((p) => p.sourceId === 'src-card' && p.statementKey === '2026-11');
    if (cardPaid) {
      return {
        ...PLAY_STATUS_OPEN,
        reserved: 138_193,
        spent: 42_000 + 107_700,
      };
    }
    return PLAY_STATUS_OPEN;
  });
}

let mockFinanceState: UseFinanceData = {
  data: financeFixture,
  isLoading: false,
  error: null,
};

let createTxSpy = vi.fn<(input: CreateTransactionInput) => Promise<Transaction>>();
let deleteTxSpy = vi.fn<(id: string) => Promise<void>>();
let payBillSpy = vi.fn<(input: PayBillInput) => Promise<BillPayment>>();

function renderOverview() {
  return render(
    <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<OverviewPage today={TODAY} />} />
        <Route path="/bills" element={<h1>บิล & ผ่อน</h1>} />
        <Route path="/settings" element={<h1>ตั้งค่า</h1>} />
      </Routes>
      <AppToaster />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockFinanceState = { data: financeFixture, isLoading: false, error: null };
  createTxSpy = vi.fn(async (input) => ({ id: 'tx-new-1', ...input }));
  deleteTxSpy = vi.fn(async () => {});
  payBillSpy = vi.fn(async (input) => ({ id: 'pay-new-1', ...input }));

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

  setupDefaultDomainMocks();
});

afterEach(() => {
  cleanup();
  toast.dismiss();
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
    expect(within(upcoming).getByText('จ่ายบิลบัตรเครดิต')).toBeTruthy();
    expect(within(upcoming).getByText('Gemini + YouTube')).toBeTruthy();
    expect(within(upcoming).getByText('Claude')).toBeTruthy();
    expect(within(upcoming).getByText('iCloud')).toBeTruthy();
    expect(within(upcoming).getByText('AirPods งวด 3/10')).toBeTruthy();

    // Charge rows show channel pill and "เข้าบิล ธ.ค."
    expect(within(upcoming).getAllByText('เข้าบิล ธ.ค.')).toHaveLength(3);
    // Total outflow counts only bills (1,077.00 + 1,381.93 = 2,458.93), never charges.
    expect(screen.getByTestId('upcoming-total').textContent).toBe('฿2,458.93');
  });

  it('caps upcoming outflows at 5 rows and navigates to /bills on ดูทั้งหมด', () => {
    vi.mocked(domain.upcomingOutflows).mockReturnValue([
      ...BASE_OUTFLOWS,
      {
        date: '2026-12-12',
        dueBy: false,
        title: 'Netflix',
        amount: 41_900,
        sourceId: 'src-card',
        kind: 'charge',
        counted: false,
        statementKey: '2027-01',
      },
    ]);
    renderOverview();
    const upcoming = screen.getByTestId('upcoming');
    expect(within(upcoming).queryByText('Netflix')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'ดูทั้งหมด' }));
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
    vi.mocked(domain.potStatus).mockImplementation((pot: Pot) => {
      if (pot.id === 'pot-essential') return ESSENTIAL_STATUS;
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

  it('renders ErrorState instead of crashing when domain stubs throw', () => {
    vi.mocked(domain.payPeriod).mockImplementation(() => {
      throw new Error('not implemented: payPeriod');
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
});
